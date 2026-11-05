import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { Types } from 'mongoose';
import {
  AdRewardClaimResponseDto,
  AdRewardKind,
  AdRewardStatus,
  AdRewardTicketDto,
  CheckinClaimResponseDto,
  CheckinRestoreResponseDto,
  CurrencyEarnResponseDto,
  MeResponseDto,
  WheelSpinResponseDto,
} from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { CurrencyService } from '../src/currency/currency.service';
import { UsersService } from '../src/users/users.service';
import { CreditLedgerService } from '../src/credits/credit-ledger.service';
import { reconcileCreditLedger } from '../scripts/db-check';

describe('Phase 2: Earn Server (Playbook §2.2, §5.5, §6.6, §7.2, §7.3, §12)', () => {
  let testApp: TestAppInstance;
  let currencyService: CurrencyService;
  let usersService: UsersService;
  let creditLedgerService: CreditLedgerService;
  let currentNow: Date;

  const setMockTime = (isoString: string) => {
    currentNow = new Date(isoString);
    currencyService.setClock(() => currentNow);
    usersService.setClock(() => currentNow);
  };

  const advanceSeconds = (seconds: number) => {
    currentNow = new Date(currentNow.getTime() + seconds * 1000);
  };

  const createDeviceUser = async (
    deviceId: string,
    ip = `10.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}`,
  ): Promise<{ accessToken: string; userId: Types.ObjectId; deviceId: string }> => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client': 'native',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ deviceId }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    return {
      accessToken: body.accessToken,
      userId: new Types.ObjectId(body.user.id),
      deviceId,
    };
  };

  beforeAll(async () => {
    testApp = await createTestApp({
      rewardedAdsEnabled: true,
      starterGrant: 5,
      pricePerAction: 5,
      starterNetworkDailyCap: 100,
      anonymousSignupDailyCap: 100,
    });
    currencyService = testApp.app.get(CurrencyService);
    usersService = testApp.app.get(UsersService);
    creditLedgerService = testApp.app.get(CreditLedgerService);
  }, 60000);

  beforeEach(() => {
    // Default time: 2026-11-04 09:00:00 in Asia/Ho_Chi_Minh (02:00:00 UTC)
    setMockTime('2026-11-04T02:00:00.000Z');
    currencyService.resetPrizePicker();
  });

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  describe('1. Day Boundary in {REWARD_TZ} (Asia/Ho_Chi_Minh, UTC+7)', () => {
    it('resets daily limits exactly at 00:00:00 Asia/Ho_Chi_Minh (17:00:00 UTC)', async () => {
      const user = await createDeviceUser(`dev-tz-${crypto.randomUUID()}`);

      // 2026-11-03 23:59:50 in Asia/Ho_Chi_Minh = 2026-11-03T16:59:50Z
      setMockTime('2026-11-03T16:59:50.000Z');

      const earnBefore = (await (
        await fetch(`${testApp.baseUrl}/api/v1/currency/earn`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as CurrencyEarnResponseDto;

      expect(earnBefore.rewardDay).toBe('2026-11-03');
      expect(earnBefore.secondsUntilReset).toBe(10);

      // Claim check-in right before midnight ICT
      const checkin1 = (await (
        await fetch(`${testApp.baseUrl}/api/v1/currency/checkin`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as CheckinClaimResponseDto;

      expect(checkin1.rewardDay).toBe('2026-11-03');
      expect(checkin1.streakDays).toBe(1);
      expect(checkin1.amount).toBe(3);

      // Advance 11 seconds -> 2026-11-04 00:00:01 in Asia/Ho_Chi_Minh (2026-11-03T17:00:01Z)
      // Still 2026-11-03 in UTC, but already 2026-11-04 in Asia/Ho_Chi_Minh!
      setMockTime('2026-11-03T17:00:01.000Z');

      const earnAfter = (await (
        await fetch(`${testApp.baseUrl}/api/v1/currency/earn`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as CurrencyEarnResponseDto;

      expect(earnAfter.rewardDay).toBe('2026-11-04');
      expect(earnAfter.checkin?.checkedInToday).toBe(false);
      expect(earnAfter.checkin?.nextDay).toBe(2);

      // Claim day 2 right after 00:00 ICT
      const checkin2 = (await (
        await fetch(`${testApp.baseUrl}/api/v1/currency/checkin`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as CheckinClaimResponseDto;

      expect(checkin2.rewardDay).toBe('2026-11-04');
      expect(checkin2.streakDays).toBe(2);
      expect(checkin2.amount).toBe(3);
    });
  });

  describe('2. Check-in Ladder, Idempotency, Device Lock, Milestones & 365-day Wrap', () => {
    it('follows the 7-day ladder [3,3,5,3,3,8,10], is idempotent on repeat taps, and blocks a second account on the same device', async () => {
      const sharedPhysicalDevice = `shared-phone-${crypto.randomUUID()}`;
      const userA = await createDeviceUser(sharedPhysicalDevice);
      const userB = await createDeviceUser(`other-init-${crypto.randomUUID()}`);

      const expectedLadder = [3, 3, 5, 3, 3, 8, 10];
      let expectedBalance = 5; // starter grant

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const dayStr = `2026-11-0${dayIdx + 1}T03:00:00.000Z`;
        setMockTime(dayStr);

        const res = await fetch(`${testApp.baseUrl}/api/v1/currency/checkin`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhysicalDevice,
          },
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as CheckinClaimResponseDto;

        expectedBalance += expectedLadder[dayIdx];
        expect(body.streakDays).toBe(dayIdx + 1);
        expect(body.amount).toBe(expectedLadder[dayIdx]);
        expect(body.milestoneBonus).toBe(0);
        expect(body.balance).toBe(expectedBalance);
        expect(body.alreadyClaimed).toBe(false);

        // Idempotent second call on the same day by userA
        const repeatRes = await fetch(
          `${testApp.baseUrl}/api/v1/currency/checkin`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${userA.accessToken}`,
              'x-device-id': sharedPhysicalDevice,
            },
          },
        );
        expect(repeatRes.status).toBe(200);
        const repeatBody = (await repeatRes.json()) as CheckinClaimResponseDto;
        expect(repeatBody.alreadyClaimed).toBe(true);
        expect(repeatBody.balance).toBe(expectedBalance);

        // Second account (userB) on the same physical device gets `device_used`
        const deviceConflictRes = await fetch(
          `${testApp.baseUrl}/api/v1/currency/checkin`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${userB.accessToken}`,
              'x-device-id': sharedPhysicalDevice,
            },
          },
        );
        expect(deviceConflictRes.status).toBe(409);
        const conflictErr = (await deviceConflictRes.json()) as any;
        expect(conflictErr.error.code).toBe('device_used');
      }
    });

    it('grants milestone bonus on day 30 (+20) and day 365 (+200), then wraps to day 1 on the next day', async () => {
      const user = await createDeviceUser(`dev-milestone-${crypto.randomUUID()}`);

      // Set user at day 29 on 2026-11-03
      await testApp.connection.collection('users').updateOne(
        { _id: user.userId },
        {
          $set: {
            checkinDay: '2026-11-03',
            checkinStreak: 29,
            lastCheckinAmount: 3,
          },
        },
      );

      // Claim on 2026-11-04 -> Day 30 (week 5, dayInWeek 2 -> ladder[1] = 3, milestone 30 -> +20)
      setMockTime('2026-11-04T02:00:00.000Z');
      const res30 = await fetch(`${testApp.baseUrl}/api/v1/currency/checkin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      expect(res30.status).toBe(200);
      const body30 = (await res30.json()) as CheckinClaimResponseDto;
      expect(body30.streakDays).toBe(30);
      expect(body30.amount).toBe(3);
      expect(body30.milestoneBonus).toBe(20);
      expect(body30.balance).toBe(5 + 3 + 20);

      // Set user at day 364 on 2026-11-04
      await testApp.connection.collection('users').updateOne(
        { _id: user.userId },
        {
          $set: {
            checkinDay: '2026-11-04',
            checkinStreak: 364,
            lastCheckinAmount: 10,
          },
        },
      );

      // Claim on 2026-11-05 -> Day 365 (364 % 7 = 0 -> ladder[0] = 3, milestone 365 -> +200)
      setMockTime('2026-11-05T02:00:00.000Z');
      const res365 = await fetch(`${testApp.baseUrl}/api/v1/currency/checkin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      expect(res365.status).toBe(200);
      const body365 = (await res365.json()) as CheckinClaimResponseDto;
      expect(body365.streakDays).toBe(365);
      expect(body365.amount).toBe(3);
      expect(body365.milestoneBonus).toBe(200);

      // Next consecutive day (2026-11-06) wraps around to Day 1 of a new year (§7.2)
      setMockTime('2026-11-06T02:00:00.000Z');
      const resWrap = await fetch(`${testApp.baseUrl}/api/v1/currency/checkin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      expect(resWrap.status).toBe(200);
      const bodyWrap = (await resWrap.json()) as CheckinClaimResponseDto;
      expect(bodyWrap.streakDays).toBe(1);
      expect(bodyWrap.amount).toBe(3);
      expect(bodyWrap.milestoneBonus).toBe(0);
    });
  });

  describe('3. Streak Restore (Playbook §7.2)', () => {
    it('enforces vip_required, streak_not_restorable (>3 missed days), and allows VIP to restore 1..3 missed days as day S+m+1', async () => {
      const user = await createDeviceUser(`dev-restore-${crypto.randomUUID()}`);

      // Top up user with 50 GEM via CreditLedgerService so ledger stays balanced
      const session = await testApp.connection.startSession();
      session.startTransaction();
      await creditLedgerService.credit(
        {
          userId: user.userId,
          amount: 50,
          type: 'operator' as any,
          reason: 'operator',
        },
        session,
      );
      await session.commitTransaction();
      await session.endSession();

      // User checked in on 2026-11-01 at streak 27. Today is 2026-11-04 -> missed 2 days (Nov 2 & Nov 3)
      await testApp.connection.collection('users').updateOne(
        { _id: user.userId },
        {
          $set: {
            checkinDay: '2026-11-01',
            checkinStreak: 27,
            lastCheckinAmount: 8,
          },
        },
      );
      setMockTime('2026-11-04T02:00:00.000Z');

      // Check earn state shows restoreOffer for 2 missed days (cost = 20)
      const earnRes = await fetch(`${testApp.baseUrl}/api/v1/currency/earn`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      const earn = (await earnRes.json()) as CurrencyEarnResponseDto;
      expect(earn.checkin?.restoreOffer).toEqual({
        missedDays: 2,
        cost: 20,
        costPerDay: 10,
        streakToKeep: 27,
      });

      // Non-VIP calling restore gets 403 vip_required
      const nonVipRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/checkin/restore`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.accessToken}` },
        },
      );
      expect(nonVipRes.status).toBe(403);
      const nonVipErr = (await nonVipRes.json()) as any;
      expect(nonVipErr.error.code).toBe('vip_required');

      // Grant VIP status
      await testApp.connection.collection('users').updateOne(
        { _id: user.userId },
        {
          $set: {
            vipExpiresAt: new Date('2026-12-01T00:00:00.000Z'),
            vipProductId: 'yearlyid',
            vipWillRenew: true,
          },
        },
      );

      // VIP restores streak: S=27, m=2 -> continues as day S+m+1 = 30 (which also hits Day 30 milestone +20!)
      const restoreRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/checkin/restore`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.accessToken}` },
        },
      );
      expect(restoreRes.status).toBe(200);
      const restoreBody = (await restoreRes.json()) as CheckinRestoreResponseDto;
      expect(restoreBody.costPaid).toBe(20);
      expect(restoreBody.streakDays).toBe(30);
      expect(restoreBody.amount).toBe(3);
      expect(restoreBody.milestoneBonus).toBe(20);
      expect(restoreBody.checkedInToday).toBe(true);
      // Balance: 55 - 20 (restore) + 3 (day 30 checkin) + 20 (day 30 milestone) = 58
      expect(restoreBody.balance).toBe(58);

      // Calling restore again when already checked in today -> 400 streak_not_restorable
      const againRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/checkin/restore`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.accessToken}` },
        },
      );
      expect(againRes.status).toBe(400);
      expect(((await againRes.json()) as any).error.code).toBe(
        'streak_not_restorable',
      );

      // Missing 4 days (> RESTORE_MAX_MISSED = 3) -> streak_not_restorable
      setMockTime('2026-11-09T02:00:00.000Z'); // Nov 4 -> Nov 9 = 4 missed days (Nov 5,6,7,8)
      const earnMissed4 = (await (
        await fetch(`${testApp.baseUrl}/api/v1/currency/earn`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as CurrencyEarnResponseDto;
      expect(earnMissed4.checkin?.restoreOffer).toBeNull();
      expect(earnMissed4.checkin?.streakDays).toBe(0);

      const expiredRestoreRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/checkin/restore`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.accessToken}` },
        },
      );
      expect(expiredRestoreRes.status).toBe(400);
      expect(((await expiredRestoreRes.json()) as any).error.code).toBe(
        'streak_not_restorable',
      );
    });
  });

  describe('4. Lucky Wheel: Free Spin & Paid Spin (Playbook §7.3)', () => {
    it('enforces free_spin_available before paid spin, 1 free spin per account & device, and paid spin cost = 3', async () => {
      const sharedPhone = `wheel-phone-${crypto.randomUUID()}`;
      const userA = await createDeviceUser(sharedPhone);
      const userB = await createDeviceUser(`wheel-other-${crypto.randomUUID()}`);

      // Force deterministic prize index = 2 (prize = 5 GEM)
      currencyService.setPrizePicker(() => 2);

      // 1. Paid spin before free spin is used -> 409 free_spin_available
      const earlyPaidRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/paid-spin`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
        },
      );
      expect(earlyPaidRes.status).toBe(409);
      expect(((await earlyPaidRes.json()) as any).error.code).toBe(
        'free_spin_available',
      );

      // 2. Free spin succeeds for userA
      const freeRes = await fetch(`${testApp.baseUrl}/api/v1/currency/spin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userA.accessToken}`,
          'x-device-id': sharedPhone,
        },
      });
      expect(freeRes.status).toBe(200);
      const freeBody = (await freeRes.json()) as WheelSpinResponseDto;
      expect(freeBody.prizeIndex).toBe(2);
      expect(freeBody.amount).toBe(5);
      expect(freeBody.balance).toBe(10); // 5 starter + 5 wheel

      // 3. Second free spin by userA on same day -> 409 free_spin_used
      const secondFreeRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/spin`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
        },
      );
      expect(secondFreeRes.status).toBe(409);
      expect(((await secondFreeRes.json()) as any).error.code).toBe(
        'free_spin_used',
      );

      // 4. Free spin by userB on the same physical phone -> 409 device_used
      const deviceFreeRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/spin`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userB.accessToken}`,
            'x-device-id': sharedPhone,
          },
        },
      );
      expect(deviceFreeRes.status).toBe(409);
      expect(((await deviceFreeRes.json()) as any).error.code).toBe(
        'device_used',
      );

      // 5. Paid spin now works for userA (costs 3 GEM, wins prizeIndex 0 = 2 GEM)
      currencyService.setPrizePicker(() => 0);
      const paidRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/paid-spin`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
        },
      );
      expect(paidRes.status).toBe(200);
      const paidBody = (await paidRes.json()) as WheelSpinResponseDto;
      expect(paidBody.cost).toBe(3);
      expect(paidBody.prizeIndex).toBe(0);
      expect(paidBody.amount).toBe(2);
      expect(paidBody.balance).toBe(9); // 10 - 3 + 2 = 9

      // 6. Drain userB balance so < 3 GEM, then attempt paid spin (allowed since device used free spin, but fails with gems_insufficient)
      const session = await testApp.connection.startSession();
      session.startTransaction();
      await creditLedgerService.debit(
        {
          userId: userB.userId,
          amount: 4,
          type: 'single' as any,
          reason: 'single',
        },
        session,
      );
      await session.commitTransaction();
      await session.endSession();

      const shortPaidRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/paid-spin`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userB.accessToken}`,
            'x-device-id': sharedPhone,
          },
        },
      );
      expect(shortPaidRes.status).toBe(402);
      expect(((await shortPaidRes.json()) as any).error.code).toBe(
        'gems_insufficient',
      );
    });
  });

  describe('5. Rewarded Ad Tickets, 15s Min Watch Time, Caps (Account & Device) & Idempotency', () => {
    it('enforces ad_reward_locked, ad_not_finished (<15s), idempotent claim, release, and all daily caps per account & device', async () => {
      const sharedPhone = `ad-phone-${crypto.randomUUID()}`;
      const userA = await createDeviceUser(sharedPhone);
      const userB = await createDeviceUser(`ad-other-${crypto.randomUUID()}`);

      // A. Preconditions: `checkin` double ad locked before check-in; `spin` ad locked before free spin
      const lockedCheckinRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
          body: JSON.stringify({ kind: AdRewardKind.CHECKIN }),
        },
      );
      expect(lockedCheckinRes.status).toBe(409);
      expect(((await lockedCheckinRes.json()) as any).error.code).toBe(
        'ad_reward_locked',
      );

      const lockedSpinRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
          body: JSON.stringify({ kind: AdRewardKind.SPIN }),
        },
      );
      expect(lockedSpinRes.status).toBe(409);
      expect(((await lockedSpinRes.json()) as any).error.code).toBe(
        'ad_reward_locked',
      );

      // B. Check in on userA (+3 GEM), then create & claim `checkin` double ticket (cap = 1)
      await fetch(`${testApp.baseUrl}/api/v1/currency/checkin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userA.accessToken}`,
          'x-device-id': sharedPhone,
        },
      });

      const createCheckinTicketRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
          body: JSON.stringify({ kind: AdRewardKind.CHECKIN }),
        },
      );
      expect(createCheckinTicketRes.status).toBe(201);
      const checkinTicket =
        (await createCheckinTicketRes.json()) as AdRewardTicketDto;
      expect(checkinTicket.status).toBe(AdRewardStatus.PENDING);

      // Claim too early (after 5s < 15s) -> 400 ad_not_finished with retryAfter = 10
      advanceSeconds(5);
      const earlyClaimRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards/${checkinTicket.id}/claim`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
        },
      );
      expect(earlyClaimRes.status).toBe(400);
      const earlyClaimErr = (await earlyClaimRes.json()) as any;
      expect(earlyClaimErr.error.code).toBe('ad_not_finished');
      expect(earlyClaimErr.error.details.retryAfter).toBe(10);

      // Advance another 11s (total 16s >= 15s) -> claim succeeds (+3 GEM)
      advanceSeconds(11);
      const claimCheckinRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards/${checkinTicket.id}/claim`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
        },
      );
      expect(claimCheckinRes.status).toBe(200);
      const claimCheckinBody =
        (await claimCheckinRes.json()) as AdRewardClaimResponseDto;
      expect(claimCheckinBody.status).toBe(AdRewardStatus.REWARDED);
      expect(claimCheckinBody.amount).toBe(3);
      expect(claimCheckinBody.balance).toBe(11); // 5 starter + 3 checkin + 3 double

      // Idempotent duplicate claim on the same ticket returns the same result without extra credit
      const dupClaimRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards/${checkinTicket.id}/claim`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
        },
      );
      expect(dupClaimRes.status).toBe(200);
      const dupClaimBody =
        (await dupClaimRes.json()) as AdRewardClaimResponseDto;
      expect(dupClaimBody.balance).toBe(11);

      // Second `checkin` double ticket on the same day -> 429 ad_limit_reached (cap = 1)
      const secondCheckinTicketRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
          body: JSON.stringify({ kind: AdRewardKind.CHECKIN }),
        },
      );
      expect(secondCheckinTicketRes.status).toBe(429);
      expect(((await secondCheckinTicketRes.json()) as any).error.code).toBe(
        'ad_limit_reached',
      );

      // C. Extra wheel spins (`kind = spin`, cap = 3 per account & device)
      currencyService.setPrizePicker(() => 1); // prize = 3 GEM
      await fetch(`${testApp.baseUrl}/api/v1/currency/spin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userA.accessToken}`,
          'x-device-id': sharedPhone,
        },
      });

      for (let i = 0; i < 3; i++) {
        const tRes = await fetch(
          `${testApp.baseUrl}/api/v1/currency/ad-rewards`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userA.accessToken}`,
              'x-device-id': sharedPhone,
            },
            body: JSON.stringify({ kind: AdRewardKind.SPIN }),
          },
        );
        expect(tRes.status).toBe(201);
        const ticket = (await tRes.json()) as AdRewardTicketDto;
        advanceSeconds(16);
        const cRes = await fetch(
          `${testApp.baseUrl}/api/v1/currency/ad-rewards/${ticket.id}/claim`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${userA.accessToken}`,
              'x-device-id': sharedPhone,
            },
          },
        );
        expect(cRes.status).toBe(200);
        const cBody = (await cRes.json()) as AdRewardClaimResponseDto;
        expect(cBody.status).toBe(AdRewardStatus.REWARDED);
        expect(cBody.prizeIndex).toBe(1);
        expect(cBody.amount).toBe(3);
      }

      // 4th spin ticket on userA -> 429 ad_limit_reached
      const fourthSpinRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
          body: JSON.stringify({ kind: AdRewardKind.SPIN }),
        },
      );
      expect(fourthSpinRes.status).toBe(429);

      // userB on the same device also gets 429 ad_limit_reached for `spin` (device cap = 3 reached)
      const userBSpinRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userB.accessToken}`,
            'x-device-id': sharedPhone,
          },
          body: JSON.stringify({ kind: AdRewardKind.SPIN }),
        },
      );
      expect(userBSpinRes.status).toBe(429);

      // D. Bonus ads (`kind = bonus`, +3 GEM, cap = 5 per day) + Ticket Release + Capped at claim time
      // First test ticket release (`DELETE /api/v1/currency/ad-rewards/:id`)
      const releaseTicketRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
          body: JSON.stringify({ kind: AdRewardKind.BONUS }),
        },
      );
      const toRelease = (await releaseTicketRes.json()) as AdRewardTicketDto;
      const delRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards/${toRelease.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${userA.accessToken}` },
        },
      );
      expect(delRes.status).toBe(200);
      expect(((await delRes.json()) as any).status).toBe(
        AdRewardStatus.RELEASED,
      );

      // Claiming a released ticket fails with 409 ticket_released
      advanceSeconds(16);
      const claimReleasedRes = await fetch(
        `${testApp.baseUrl}/api/v1/currency/ad-rewards/${toRelease.id}/claim`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${userA.accessToken}` },
        },
      );
      expect(claimReleasedRes.status).toBe(409);
      expect(((await claimReleasedRes.json()) as any).error.code).toBe(
        'ticket_released',
      );

      // Claim 4 bonus ads on userA
      for (let i = 0; i < 4; i++) {
        const tRes = await fetch(
          `${testApp.baseUrl}/api/v1/currency/ad-rewards`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userA.accessToken}`,
              'x-device-id': sharedPhone,
            },
            body: JSON.stringify({ kind: AdRewardKind.BONUS }),
          },
        );
        const ticket = (await tRes.json()) as AdRewardTicketDto;
        advanceSeconds(16);
        const cRes = await fetch(
          `${testApp.baseUrl}/api/v1/currency/ad-rewards/${ticket.id}/claim`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${userA.accessToken}`,
              'x-device-id': sharedPhone,
            },
          },
        );
        expect(cRes.status).toBe(200);
      }

      // Now 4/5 bonus ads used on `sharedPhone`.
      // Both userA and userB create a pending ticket before the 5th slot is claimed:
      const ticketA5 = (await (
        await fetch(`${testApp.baseUrl}/api/v1/currency/ad-rewards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userA.accessToken}`,
            'x-device-id': sharedPhone,
          },
          body: JSON.stringify({ kind: AdRewardKind.BONUS }),
        })
      ).json()) as AdRewardTicketDto;

      const ticketB5 = (await (
        await fetch(`${testApp.baseUrl}/api/v1/currency/ad-rewards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userB.accessToken}`,
            'x-device-id': sharedPhone,
          },
          body: JSON.stringify({ kind: AdRewardKind.BONUS }),
        })
      ).json()) as AdRewardTicketDto;

      advanceSeconds(16);

      // userA claims the 5th slot -> status = 'rewarded'
      const claimA5 = (await (
        await fetch(
          `${testApp.baseUrl}/api/v1/currency/ad-rewards/${ticketA5.id}/claim`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${userA.accessToken}`,
              'x-device-id': sharedPhone,
            },
          },
        )
      ).json()) as AdRewardClaimResponseDto;
      expect(claimA5.status).toBe(AdRewardStatus.REWARDED);
      expect(claimA5.amount).toBe(3);

      // userB claims after the device cap (5) was just reached -> status = 'capped', amount = 0
      const claimB5 = (await (
        await fetch(
          `${testApp.baseUrl}/api/v1/currency/ad-rewards/${ticketB5.id}/claim`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${userB.accessToken}`,
              'x-device-id': sharedPhone,
            },
          },
        )
      ).json()) as AdRewardClaimResponseDto;
      expect(claimB5.status).toBe(AdRewardStatus.CAPPED);
      expect(claimB5.amount).toBe(0);
    });
  });

  describe('6. VIP Daily Grant on GET /api/v1/me (Playbook §2.2 & §6.6)', () => {
    it('grants +50 GEM once per reward day in Asia/Ho_Chi_Minh on the first GET /api/v1/me', async () => {
      const user = await createDeviceUser(`vip-daily-${crypto.randomUUID()}`);

      await testApp.connection.collection('users').updateOne(
        { _id: user.userId },
        {
          $set: {
            vipExpiresAt: new Date('2026-12-31T00:00:00.000Z'),
            vipProductId: 'yearlyid',
            vipWillRenew: true,
          },
        },
      );

      setMockTime('2026-11-04T02:00:00.000Z'); // 2026-11-04 in ICT

      // First call on 2026-11-04 grants +50 GEM
      const me1 = (await (
        await fetch(`${testApp.baseUrl}/api/v1/me`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as MeResponseDto;

      expect(me1.grantedNow).toBe(true);
      expect(me1.vipDailyGranted).toBe(50);
      expect(me1.balance).toBe(55); // 5 starter + 50 VIP daily

      // Second call on the same reward day does NOT grant again
      const me2 = (await (
        await fetch(`${testApp.baseUrl}/api/v1/me`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as MeResponseDto;

      expect(me2.grantedNow).toBe(false);
      expect(me2.balance).toBe(55);

      // Next reward day in Asia/Ho_Chi_Minh (2026-11-04T17:00:05Z = 2026-11-05 00:00:05 ICT)
      setMockTime('2026-11-04T17:00:05.000Z');
      const me3 = (await (
        await fetch(`${testApp.baseUrl}/api/v1/me`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as MeResponseDto;

      expect(me3.grantedNow).toBe(true);
      expect(me3.vipDailyGranted).toBe(50);
      expect(me3.balance).toBe(105);

      // Verify ledger reconciliation across the entire test database
      const reconciliation = await reconcileCreditLedger(testApp.connection);
      expect(reconciliation.ok).toBe(true);
      expect(reconciliation.mismatches).toHaveLength(0);
    });
  });
});
