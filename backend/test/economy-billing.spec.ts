import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { Types } from 'mongoose';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  BillingVerifyResponseDto,
  HandOrientation,
  ImageQuality,
  MeResponseDto,
  PalmResult,
  ReadingSchool,
  ReadingStatus,
} from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { deleteUserAccount } from '../scripts/users-delete';
import { BillingService } from '../src/billing/billing.service';
import { PlayPurchaseVerifier } from '../src/billing/play-purchase.verifier';
import { UsersService } from '../src/users/users.service';
import { ReadingsService } from '../src/readings/readings.service';
import { AiService } from '../src/ai/ai.service';
import { reconcileCreditLedger } from '../scripts/db-check';

describe('Phase 7 Backend: Billing, Subscriptions, RTDN & VIP School Gating (Playbook §2.2, §5.6, §6.1–§6.6, §10, §11.10)', () => {
  let testApp: TestAppInstance;
  let billingService: BillingService;
  let playVerifier: PlayPurchaseVerifier;
  let usersService: UsersService;
  let readingsService: ReadingsService;
  let aiService: AiService;
  let testImageBuffer: Buffer;
  let currentNow: Date;

  const setMockTime = (isoString: string) => {
    currentNow = new Date(isoString);
    billingService.setClock(() => currentNow);
    usersService.setClock(() => currentNow);
    readingsService.setClock(() => currentNow);
  };

  const createDeviceUser = async (
    deviceId = `dev-bill-${crypto.randomUUID()}`,
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
    billingService = testApp.app.get(BillingService);
    playVerifier = testApp.app.get(PlayPurchaseVerifier);
    usersService = testApp.app.get(UsersService);
    readingsService = testApp.app.get(ReadingsService);
    aiService = testApp.app.get(AiService);

    testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 120, g: 150, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();
  }, 60000);

  beforeEach(() => {
    setMockTime('2026-11-04T02:00:00.000Z'); // 09:00 ICT on 2026-11-04
    playVerifier.resetVerifier();
  });

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  describe('1. Trial vs Paid First-Purchase Attribution & VIP Daily Grant (Playbook §5.6, §6.5, §11.10)', () => {
    it('returns firstPurchase: false on weeklyid free trial, grants +50 VIP daily GEM immediately, and returns firstPurchase: true only on first paid purchase', async () => {
      const user = await createDeviceUser();
      const trialToken = `trial_token_${crypto.randomUUID()}`;

      // 1. Verify weeklyid free trial (priceAmountMicros = 0, isTrial = true)
      const trialRes = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          productId: 'weeklyid',
          purchaseToken: trialToken,
          isTrial: true,
          priceAmountMicros: 0,
          priceCurrencyCode: 'USD',
        }),
      });
      expect(trialRes.status).toBe(200);
      const trialBody = (await trialRes.json()) as BillingVerifyResponseDto;

      expect(trialBody.vip.active).toBe(true);
      expect(trialBody.vip.productId).toBe('weeklyid');
      expect(trialBody.vip.willRenew).toBe(true);
      // NEVER fire firstPurchase on a trial start! (Playbook §5.6)
      expect(trialBody.firstPurchase).toBe(false);
      // Immediate VIP daily grant (+50 GEM) on activation
      expect(trialBody.grantedNow).toBe(true);
      expect(trialBody.vipDailyGranted).toBe(50);
      expect(trialBody.balance).toBe(55); // 5 starter + 50 vip_daily
      expect(trialBody.billingRef).toHaveLength(64);

      // Subsequent GET /api/v1/me on the same reward day does not double-grant vip_daily
      const meRes = await fetch(`${testApp.baseUrl}/api/v1/me`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      const meBody = (await meRes.json()) as MeResponseDto;
      expect(meBody.vip?.active).toBe(true);
      expect(meBody.grantedNow).toBe(false);
      expect(meBody.balance).toBe(55);

      // 2. User upgrades from weeklyid trial to paid yearlyid ($99 = 99_000_000 micros)
      const yearlyToken = `paid_yearly_${crypto.randomUUID()}`;
      const paidRes = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          productId: 'yearlyid',
          purchaseToken: yearlyToken,
          isTrial: false,
          priceAmountMicros: 99_000_000,
          priceCurrencyCode: 'USD',
          orderId: 'GPA.3333-4444-5555-66666',
          adjustAdid: 'adj-adid-123',
        }),
      });
      expect(paidRes.status).toBe(200);
      const paidBody = (await paidRes.json()) as BillingVerifyResponseDto;

      expect(paidBody.vip.active).toBe(true);
      expect(paidBody.vip.productId).toBe('yearlyid');
      // First paid purchase for this user -> firstPurchase: true!
      expect(paidBody.firstPurchase).toBe(true);
      // Upgrade mode superseded the old weeklyid trial token
      expect(paidBody.supersededPurchaseToken).toBe(trialToken);
      expect(paidBody.grantedNow).toBe(false); // already granted today
      expect(paidBody.balance).toBe(55);

      // Check old subscription in DB has supersededBy = yearlyToken and willRenew = false
      const oldSubDoc = await testApp.connection
        .collection('play_subscriptions')
        .findOne({ purchaseToken: trialToken });
      expect(oldSubDoc?.supersededBy).toBe(yearlyToken);
      expect(oldSubDoc?.willRenew).toBe(false);

      // 3. Re-verifying the same paid token (e.g. on next app launch reconcile) -> firstPurchase: false, restored: true
      const repeatRes = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          productId: 'yearlyid',
          purchaseToken: yearlyToken,
          isTrial: false,
          priceAmountMicros: 99_000_000,
          priceCurrencyCode: 'USD',
        }),
      });
      expect(repeatRes.status).toBe(200);
      const repeatBody = (await repeatRes.json()) as BillingVerifyResponseDto;
      expect(repeatBody.firstPurchase).toBe(false);
      expect(repeatBody.restored).toBe(true);
    });

    it('rejects unknown productId or invalid purchaseToken with 400', async () => {
      const user = await createDeviceUser();

      const badProdRes = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          productId: 'unknown_plan_id',
          purchaseToken: 'some_token',
        }),
      });
      expect(badProdRes.status).toBe(400);
      expect(((await badProdRes.json()) as any).error.code).toBe('invalid_product');

      const badTokenRes = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          productId: 'weeklyid',
          purchaseToken: 'invalid_token_xyz',
        }),
      });
      expect(badTokenRes.status).toBe(400);
      expect(((await badTokenRes.json()) as any).error.code).toBe('invalid_purchase');
    });
  });

  describe('2. Restore & Reinstall Transfer Across Accounts (Playbook §6.2 & §6.5)', () => {
    it('moves an active subscription from a deleted guest to the new guest on the same device', async () => {
      const verify = (accessToken: string, purchaseToken: string) =>
        fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            productId: 'weeklyid',
            purchaseToken,
            isTrial: false,
            priceAmountMicros: 6_990_000,
            priceCurrencyCode: 'USD',
          }),
        });

      const oldGuest = await createDeviceUser();
      const purchaseToken = `deleted_owner_token_${crypto.randomUUID()}`;
      expect((await verify(oldGuest.accessToken, purchaseToken)).status).toBe(200);

      await deleteUserAccount(
        testApp.connection,
        oldGuest.userId.toString(),
        'Restore after deletion test',
        'test-identity-secret-at-least-32-chars-long',
      );
      const newGuest = await createDeviceUser(oldGuest.deviceId);
      expect(newGuest.userId.toString()).not.toBe(oldGuest.userId.toString());

      const restoreRes = await verify(newGuest.accessToken, purchaseToken);
      expect(restoreRes.status).toBe(200);
      const restored = (await restoreRes.json()) as BillingVerifyResponseDto;
      expect(restored.restored).toBe(true);
      expect(restored.firstPurchase).toBe(false);
      expect(restored.vip.active).toBe(true);

      const subscriptions = await testApp.connection
        .collection('play_subscriptions')
        .find({ purchaseToken })
        .toArray();
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].userId.toString()).toBe(newGuest.userId.toString());
    });

    it('transfers an active subscription from an old guest account to the current account on restore without re-firing firstPurchase', async () => {
      const oldGuest = await createDeviceUser();
      const newAccount = await createDeviceUser();
      const sharedPurchaseToken = `restore_token_${crypto.randomUUID()}`;

      // Old guest buys paid weeklyid
      const buyRes = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${oldGuest.accessToken}`,
        },
        body: JSON.stringify({
          productId: 'weeklyid',
          purchaseToken: sharedPurchaseToken,
          isTrial: false,
          priceAmountMicros: 6_990_000,
          priceCurrencyCode: 'USD',
        }),
      });
      expect(buyRes.status).toBe(200);
      const buyBody = (await buyRes.json()) as BillingVerifyResponseDto;
      expect(buyBody.vip.active).toBe(true);
      expect(buyBody.firstPurchase).toBe(true);

      // User reinstalls app / switches to newAccount and restores purchase
      const restoreRes = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newAccount.accessToken}`,
        },
        body: JSON.stringify({
          productId: 'weeklyid',
          purchaseToken: sharedPurchaseToken,
          isTrial: false,
          priceAmountMicros: 6_990_000,
          priceCurrencyCode: 'USD',
        }),
      });
      expect(restoreRes.status).toBe(200);
      const restoreBody = (await restoreRes.json()) as BillingVerifyResponseDto;

      expect(restoreBody.vip.active).toBe(true);
      expect(restoreBody.vip.productId).toBe('weeklyid');
      expect(restoreBody.restored).toBe(true);
      // Must NOT fire firstPurchase again since this token already counted firstPurchase!
      expect(restoreBody.firstPurchase).toBe(false);
      // New account gets its daily VIP gift
      expect(restoreBody.grantedNow).toBe(true);
      expect(restoreBody.balance).toBe(55);

      // Old guest account no longer has VIP active
      const oldMeRes = await fetch(`${testApp.baseUrl}/api/v1/me`, {
        headers: { Authorization: `Bearer ${oldGuest.accessToken}` },
      });
      const oldMe = (await oldMeRes.json()) as MeResponseDto;
      expect(oldMe.vip?.active).toBe(false);
    });
  });

  describe('3. Google Play RTDN Webhook Idempotency & Lifecycle Updates (Playbook §10)', () => {
    it('deduplicates RTDN events in billing_events and updates subscription on cancel (type 3) and expire (type 13)', async () => {
      const user = await createDeviceUser();
      const token = `rtdn_sub_${crypto.randomUUID()}`;

      // Activate subscription first
      const verifyRes = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          productId: 'weeklyid',
          purchaseToken: token,
          priceAmountMicros: 6_990_000,
        }),
      });
      expect(verifyRes.status).toBe(200);

      // Google now reports auto-renew off; the RTDN only tells us to look it up.
      const activeUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      playVerifier.setVerifier(async (input) => ({
        productId: input.productId,
        purchaseToken: input.purchaseToken,
        orderId: 'GPA.TEST',
        expiresAt: activeUntil,
        willRenew: false,
        isTrial: false,
        priceAmountMicros: 6_990_000,
        priceCurrencyCode: 'USD',
        acknowledged: true,
      }));

      // 1. Send Pub/Sub formatted RTDN notificationType = 3 (SUBSCRIPTION_CANCELED)
      const pubSubData = Buffer.from(
        JSON.stringify({
          version: '1.0',
          packageName: 'com.palmsight.app',
          subscriptionNotification: {
            version: '1.0',
            notificationType: 3,
            purchaseToken: token,
            subscriptionId: 'weeklyid',
          },
        }),
      ).toString('base64');

      const cancelEventId = `msg-cancel-${crypto.randomUUID()}`;
      const rtdnCancelRes = await fetch(`${testApp.baseUrl}/api/v1/billing/rtdn?token=test-rtdn-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            messageId: cancelEventId,
            data: pubSubData,
          },
        }),
      });
      expect(rtdnCancelRes.status).toBe(200);
      const cancelResult = (await rtdnCancelRes.json()) as any;
      expect(cancelResult).toEqual({
        received: true,
        duplicate: false,
        eventId: cancelEventId,
        updatedSubscription: true,
      });

      // Duplicate delivery of the exact same messageId is ignored idempotently
      const dupCancelRes = await fetch(`${testApp.baseUrl}/api/v1/billing/rtdn?token=test-rtdn-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            messageId: cancelEventId,
            data: pubSubData,
          },
        }),
      });
      expect(dupCancelRes.status).toBe(200);
      const dupResult = (await dupCancelRes.json()) as any;
      expect(dupResult.duplicate).toBe(true);
      expect(dupResult.updatedSubscription).toBe(false);

      // User is still active until expiry, but willRenew is now false
      const meAfterCancel = (await (
        await fetch(`${testApp.baseUrl}/api/v1/me`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as MeResponseDto;
      expect(meAfterCancel.vip?.active).toBe(true);
      expect(meAfterCancel.vip?.willRenew).toBe(false);

      // 2. Send RTDN notificationType = 13 (SUBSCRIPTION_EXPIRED)
      const expireEventId = `msg-expire-${crypto.randomUUID()}`;
      const rtdnExpireRes = await fetch(`${testApp.baseUrl}/api/v1/billing/rtdn?token=test-rtdn-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: expireEventId,
          purchaseToken: token,
          notificationType: 13,
          productId: 'weeklyid',
        }),
      });
      expect(rtdnExpireRes.status).toBe(200);

      // User VIP is now inactive
      const meAfterExpire = (await (
        await fetch(`${testApp.baseUrl}/api/v1/me`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as MeResponseDto;
      expect(meAfterExpire.vip?.active).toBe(false);
      expect(meAfterExpire.vip?.productId).toBeNull();
      expect(meAfterExpire.vip?.willRenew).toBe(false);
    });
  });

  describe('3b. RTDN authentication (Playbook §2.2)', () => {
    const activateSubscription = async () => {
      const user = await createDeviceUser();
      const token = `rtdn_auth_${crypto.randomUUID()}`;
      const res = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          productId: 'weeklyid',
          purchaseToken: token,
          priceAmountMicros: 6_990_000,
        }),
      });
      expect(res.status).toBe(200);
      return { user, token };
    };

    it.each([
      ['no token', ''],
      ['a wrong token', '?token=wrong'],
    ])('rejects a webhook call with %s', async (_label, query) => {
      const { token } = await activateSubscription();
      const res = await fetch(
        `${testApp.baseUrl}/api/v1/billing/rtdn${query}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: `forged-${crypto.randomUUID()}`,
            purchaseToken: token,
            notificationType: 13,
          }),
        },
      );
      expect(res.status).toBe(401);
    });

    it('takes expiry from Google, never from the notification body', async () => {
      const { user, token } = await activateSubscription();
      const googleExpiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      playVerifier.setVerifier(async (input) => ({
        productId: input.productId,
        purchaseToken: input.purchaseToken,
        orderId: 'GPA.TEST',
        expiresAt: googleExpiry,
        willRenew: true,
        isTrial: false,
        priceAmountMicros: 6_990_000,
        priceCurrencyCode: 'USD',
        acknowledged: true,
      }));

      const res = await fetch(
        `${testApp.baseUrl}/api/v1/billing/rtdn?token=test-rtdn-token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: `renew-${crypto.randomUUID()}`,
            purchaseToken: token,
            notificationType: 2,
            expiresAt: '2099-01-01T00:00:00.000Z',
            willRenew: true,
          }),
        },
      );
      expect(res.status).toBe(200);

      const me = (await (
        await fetch(`${testApp.baseUrl}/api/v1/me`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as MeResponseDto;
      expect(me.vip?.expiresAt).toBe(googleExpiry.toISOString());
    });

    it('leaves no event behind when Google is unavailable, so Pub/Sub can redeliver', async () => {
      const { token } = await activateSubscription();
      playVerifier.setVerifier(async () => {
        throw new ServiceUnavailableException({ code: 'billing_unavailable' });
      });

      const eventId = `outage-${crypto.randomUUID()}`;
      const send = () =>
        fetch(`${testApp.baseUrl}/api/v1/billing/rtdn?token=test-rtdn-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            purchaseToken: token,
            notificationType: 2,
          }),
        });

      expect((await send()).status).toBe(503);

      playVerifier.resetVerifier();
      const retried = await send();
      expect(retried.status).toBe(200);
      expect(((await retried.json()) as any).duplicate).toBe(false);
    });
  });

  describe('3c. Google state over client hints (Playbook §5.6)', () => {
    const googleSays = (phase: { isTrial: boolean; expiresAt?: Date }) =>
      playVerifier.setVerifier(async (input) => ({
        productId: input.productId,
        purchaseToken: input.purchaseToken,
        orderId: 'GPA.TEST',
        expiresAt: phase.expiresAt ?? new Date(currentNow.getTime() + 3 * 24 * 60 * 60 * 1000),
        willRenew: true,
        isTrial: phase.isTrial,
        priceAmountMicros: phase.isTrial ? 0 : 6_990_000,
        priceCurrencyCode: 'USD',
        acknowledged: true,
      }));

    const verify = async (accessToken: string, token: string) => {
      const res = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          productId: 'weeklyid',
          purchaseToken: token,
          priceAmountMicros: 6_990_000,
          isTrial: false,
        }),
      });
      expect(res.status).toBe(200);
      return (await res.json()) as BillingVerifyResponseDto;
    };

    const rtdn = (eventId: string, token: string, notificationType: number) =>
      fetch(`${testApp.baseUrl}/api/v1/billing/rtdn?token=test-rtdn-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, purchaseToken: token, notificationType }),
      });

    it('fires firstPurchase once, when a trial turns paid, not when a new process reconciles the trial', async () => {
      const user = await createDeviceUser();
      const token = `trial_flow_${crypto.randomUUID()}`;

      googleSays({ isTrial: true });
      expect((await verify(user.accessToken, token)).firstPurchase).toBe(false);
      expect((await verify(user.accessToken, token)).firstPurchase).toBe(false);

      googleSays({ isTrial: false });
      expect((await verify(user.accessToken, token)).firstPurchase).toBe(true);
      expect((await verify(user.accessToken, token)).firstPurchase).toBe(false);
    });

    it('does not reopen VIP when a revoked token is verified again', async () => {
      const user = await createDeviceUser();
      const token = `revoked_${crypto.randomUUID()}`;

      googleSays({ isTrial: false });
      expect((await verify(user.accessToken, token)).vip.active).toBe(true);

      googleSays({ isTrial: false, expiresAt: new Date(currentNow.getTime() - 1000) });
      expect((await rtdn(`revoke-${crypto.randomUUID()}`, token, 12)).status).toBe(200);

      expect((await verify(user.accessToken, token)).vip.active).toBe(false);
    });

    describe('two tokens on one account', () => {
      const days = (n: number) => new Date(currentNow.getTime() + n * 24 * 60 * 60 * 1000);

      const verifyAs = (accessToken: string, token: string, expiresAt: Date) => {
        googleSays({ isTrial: false, expiresAt });
        return verify(accessToken, token);
      };

      it.each([
        ['the live token first', [0, 1]],
        ['the dead token first', [1, 0]],
      ])('keeps VIP from the live token with %s, across two reconciles', async (_label, order) => {
        const user = await createDeviceUser();
        const tokens = [
          { token: `live_${crypto.randomUUID()}`, expiresAt: days(300) },
          { token: `dead_${crypto.randomUUID()}`, expiresAt: days(-1) },
        ];

        for (const round of [1, 2]) {
          for (const [position, index] of order.entries()) {
            const { token, expiresAt } = tokens[index];
            const body = await verifyAs(user.accessToken, token, expiresAt);
            if (round === 2 || position === 1) {
              expect(body.vip.active).toBe(true);
              expect(body.vip.expiresAt).toBe(days(300).toISOString());
            }
          }
        }

        const me = (await (
          await fetch(`${testApp.baseUrl}/api/v1/me`, {
            headers: { Authorization: `Bearer ${user.accessToken}` },
          })
        ).json()) as MeResponseDto;
        expect(me.vip?.active).toBe(true);
        expect(me.vip?.expiresAt).toBe(days(300).toISOString());
      });

      it('keeps the longer plan when a shorter live token is verified after it', async () => {
        const user = await createDeviceUser();
        const yearly = `yearly_${crypto.randomUUID()}`;
        const weekly = `weekly_${crypto.randomUUID()}`;

        await verifyAs(user.accessToken, yearly, days(300));
        const body = await verifyAs(user.accessToken, weekly, days(5));

        expect(body.supersededPurchaseToken).toBeNull();
        expect(body.vip.expiresAt).toBe(days(300).toISOString());
      });

      it('leaves a replaced token replaced when it is verified again', async () => {
        const user = await createDeviceUser();
        const weekly = `weekly_${crypto.randomUUID()}`;
        const yearly = `yearly_${crypto.randomUUID()}`;

        await verifyAs(user.accessToken, weekly, days(5));
        const upgrade = await verifyAs(user.accessToken, yearly, days(300));
        expect(upgrade.supersededPurchaseToken).toBe(weekly);

        await verifyAs(user.accessToken, weekly, days(5));

        const models = testApp.connection.collection('play_subscriptions');
        const weeklyDoc = await models.findOne({ purchaseToken: weekly });
        expect(weeklyDoc?.supersededBy).toBe(yearly);
      });

      it('grants no VIP daily to an account whose only token is dead', async () => {
        const user = await createDeviceUser();
        const body = await verifyAs(
          user.accessToken,
          `dead_${crypto.randomUUID()}`,
          days(-1),
        );

        expect(body.vip.active).toBe(false);
        expect(body.grantedNow).toBe(false);
      });
    });

    it('records the event for a token Google no longer knows, and still ends access on 13', async () => {
      const user = await createDeviceUser();
      const token = `gone_${crypto.randomUUID()}`;
      googleSays({ isTrial: false });
      await verify(user.accessToken, token);

      playVerifier.setVerifier(async () => {
        throw new BadRequestException({ code: 'invalid_purchase' });
      });
      const eventId = `gone-${crypto.randomUUID()}`;
      const first = await rtdn(eventId, token, 13);
      expect(first.status).toBe(200);

      const again = await rtdn(eventId, token, 13);
      expect(((await again.json()) as any).duplicate).toBe(true);

      const me = (await (
        await fetch(`${testApp.baseUrl}/api/v1/me`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as MeResponseDto;
      expect(me.vip?.active).toBe(false);
    });
  });

  describe('4. VIP-Only Feature Gating: Eastern & Vedic Palmistry Schools (Playbook §1.1 & §6.6)', () => {
    const mockEasternResult: PalmResult = {
      isPalm: true,
      rejectReason: null,
      school: ReadingSchool.EASTERN,
      hand: HandOrientation.LEFT,
      imageQuality: ImageQuality.GOOD,
      topics: ['nguHanh', 'thienVan', 'love'],
      sections: [
        {
          key: 'nguHanh',
          title: 'Dáng tay ngũ hành',
          observation: 'Tay Mộc thon dài',
          meaning: 'Giàu trí tưởng tượng và nhân ái',
        },
      ],
      aspects: { love: 'Tình duyên thuận lợi' },
      summary: 'Bàn tay phương Đông cát tường.',
      advice: 'Kiên trì theo đuổi mục tiêu.',
      disclaimer: 'Kết quả chỉ mang tính tham khảo.',
    };

    const sendReading = async (accessToken: string, school: ReadingSchool) => {
      const formData = new FormData();
      formData.append('school', school);
      formData.append('hand', HandOrientation.LEFT);
      formData.append('aiConsent', 'true');
      formData.append(
        'image',
        new Blob([testImageBuffer], { type: 'image/jpeg' }),
        'palm.jpg',
      );

      return fetch(`${testApp.baseUrl}/api/v1/readings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: formData,
      });
    };

    it('blocks non-VIP users from EASTERN and VEDIC schools with 403 vip_required without deducting GEM, while allowing WESTERN and allowing VIP users', async () => {
      const user = await createDeviceUser();

      vi.spyOn(aiService, 'readPalm').mockResolvedValue({
        result: mockEasternResult,
        provider: 'groq',
        model: 'qwen/qwen3.8-27b',
      });

      // 1. Non-VIP requesting EASTERN -> 403 vip_required
      const easternNonVipRes = await sendReading(
        user.accessToken,
        ReadingSchool.EASTERN,
      );
      expect(easternNonVipRes.status).toBe(403);
      const easternErr = (await easternNonVipRes.json()) as any;
      expect(easternErr.error.code).toBe('vip_required');

      // 2. Non-VIP requesting VEDIC -> 403 vip_required
      const vedicNonVipRes = await sendReading(
        user.accessToken,
        ReadingSchool.VEDIC,
      );
      expect(vedicNonVipRes.status).toBe(403);
      const vedicErr = (await vedicNonVipRes.json()) as any;
      expect(vedicErr.error.code).toBe('vip_required');

      // Balance is still untouched (5 GEM starter grant)
      const meBefore = (await (
        await fetch(`${testApp.baseUrl}/api/v1/me`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        })
      ).json()) as MeResponseDto;
      expect(meBefore.balance).toBe(5);

      // 3. Upgrade user to VIP via /api/v1/billing/verify (+50 GEM -> balance = 55)
      const verifyRes = await fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({
          productId: 'weeklyid',
          purchaseToken: `vip_school_${crypto.randomUUID()}`,
          isTrial: true,
          priceAmountMicros: 0,
        }),
      });
      expect(verifyRes.status).toBe(200);

      // 4. VIP user requesting EASTERN -> 201 Created (spends 5 GEM -> balance = 50)
      const easternVipRes = await sendReading(
        user.accessToken,
        ReadingSchool.EASTERN,
      );
      expect(easternVipRes.status).toBe(201);
      const easternVipBody = (await easternVipRes.json()) as any;
      expect(easternVipBody.reading.Status ?? easternVipBody.reading.status).toBe(
        ReadingStatus.DONE,
      );
      expect(easternVipBody.creditBalance).toBe(50);

      // 5. VIP user requesting VEDIC -> 201 Created (spends 5 GEM -> balance = 45)
      const vedicVipRes = await sendReading(
        user.accessToken,
        ReadingSchool.VEDIC,
      );
      expect(vedicVipRes.status).toBe(201);
      const vedicVipBody = (await vedicVipRes.json()) as any;
      expect(vedicVipBody.creditBalance).toBe(45);
    });
  });

  describe('5. Full Ledger Reconciliation Across All Billing & VIP Daily Flows', () => {
    it('maintains 100% ledger sum == user.creditBalance invariance', async () => {
      const reconciliation = await reconcileCreditLedger(testApp.connection);
      expect(reconciliation.ok).toBe(true);
      expect(reconciliation.mismatches).toHaveLength(0);
    });
  });
});
