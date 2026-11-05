import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { CreditTransactionType, ReferralStatus } from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { computeDeviceIdHash } from '../src/common/device-id-hash.util';
import { CreditLedgerService } from '../src/credits/credit-ledger.service';
import { CurrencyService } from '../src/currency/currency.service';
import { deleteUserAccount } from '../scripts/users-delete';

const JWT_SECRET = 'test-jwt-secret-palm-sight-at-least-32-chars-long';
const IDENTITY_SECRET = 'test-identity-secret-at-least-32-chars-long';
const REFERRAL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Android gửi định danh cố định `android-<ANDROID_ID>`, nên "cài lại app" chỉ là gọi lại
 * `/auth/device` với cùng deviceId (token cũ trong SecureStore đã mất).
 * Mỗi test dùng một thiết bị riêng để độc lập với nhau.
 */
describe('Android stable device id: reinstall keeps device limits', () => {
  let testApp: TestAppInstance;
  let currency: CurrencyService;
  let ledger: CreditLedgerService;
  let currentNow: Date;
  const jwtService = new JwtService({ secret: JWT_SECRET });

  const randomIp = () =>
    `10.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}`;

  const androidId = () => `android-${crypto.randomBytes(8).toString('hex')}`;

  const deviceHash = (deviceId: string) => computeDeviceIdHash(IDENTITY_SECRET, deviceId);

  // Mỗi lần gọi một IP khác để không chạm ANONYMOUS_SIGNUP_DAILY_CAP của test-helper.
  const openApp = (deviceId: string) =>
    fetch(`${testApp.baseUrl}/api/v1/auth/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client': 'native',
        'x-forwarded-for': randomIp(),
      },
      body: JSON.stringify({ deviceId }),
    });

  const install = async (deviceId: string) => {
    const res = await openApp(deviceId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    return {
      deviceId,
      token: body.accessToken as string,
      id: new Types.ObjectId(body.user.id),
      isNewUser: body.isNewUser as boolean,
      balance: body.user.creditBalance as number,
    };
  };

  const post = (path: string, token: string, deviceId?: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}/api/v1${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(deviceId ? { 'x-device-id': deviceId } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const get = async (path: string, token: string, deviceId?: string) => {
    const res = await fetch(`${testApp.baseUrl}/api/v1${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(deviceId ? { 'x-device-id': deviceId } : {}),
      },
    });
    expect(res.status).toBe(200);
    return (await res.json()) as any;
  };

  const errorCodeOf = async (res: Response) => ((await res.json()) as any).error.code;

  const deviceDoc = (deviceId: string) =>
    testApp.connection.collection('devices').findOne({ deviceIdHash: deviceHash(deviceId) });

  const countTx = (userId: Types.ObjectId, type: CreditTransactionType) =>
    testApp.connection.collection('credit_transactions').countDocuments({ userId, type });

  const ledgerSum = async (userId: Types.ObjectId) => {
    const rows = await testApp.connection
      .collection('credit_transactions')
      .find({ userId })
      .toArray();
    return rows.reduce((sum, row) => sum + row.amount, 0);
  };

  const balanceOf = async (userId: Types.ObjectId) =>
    (await testApp.connection.collection('users').findOne({ _id: userId }))?.creditBalance;

  const referralCodeOf = async (userId: Types.ObjectId) =>
    (await testApp.connection.collection('users').findOne({ _id: userId }))?.referralCode as string;

  // Tài khoản không phải guest của chính thiết bị (không có users.deviceIdHash): định danh chỉ đến từ header.
  const seedAccount = async () => {
    const id = new Types.ObjectId();
    const referralCode = Array.from(
      { length: 8 },
      () => REFERRAL_ALPHABET[crypto.randomInt(0, REFERRAL_ALPHABET.length)],
    ).join('');
    await testApp.connection.collection('users').insertOne({
      _id: id,
      displayName: `User ${id.toString().slice(-4)}`,
      email: `user.${id.toString()}@example.com`,
      creditBalance: 3,
      referralCode,
      referralBlocked: false,
      identities: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    return { id, token: jwtService.sign({ sub: id.toString(), sid: 'test-session-id' }) };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    currency = testApp.app.get(CurrencyService);
    ledger = testApp.app.get(CreditLedgerService);
    // Giải thấp nhất (2 GEM) để số dư trong test xác định được.
    currency.setPrizePicker(() => 0);
  }, 60000);

  afterAll(async () => {
    currency.resetPrizePicker();
    await closeTestApp(testApp);
  });

  beforeEach(() => {
    // Giữ nguyên "hôm nay" trong suốt một test, tránh lệch khi chạy qua nửa đêm giờ Việt Nam.
    currentNow = new Date();
    currency.setClock(() => currentNow);
  });

  afterEach(() => {
    currency.resetClock();
  });

  describe('identity', () => {
    it('accepts the android-<ANDROID_ID> format and stores only its HMAC', async () => {
      const deviceId = 'android-a1b2c3d4e5f60718';
      const guest = await install(deviceId);
      expect(guest.isNewUser).toBe(true);
      expect(guest.balance).toBe(3);

      const user = await testApp.connection.collection('users').findOne({ _id: guest.id });
      expect(user?.deviceIdHash).toBe(deviceHash(deviceId));

      const device = await deviceDoc(deviceId);
      expect(device).not.toBeNull();
      expect(JSON.stringify({ user, device })).not.toContain('a1b2c3d4e5f60718');
    });
  });

  describe('a. same guest and balance', () => {
    it('reopens the same user with the balance left after earning and spending', async () => {
      const deviceId = androidId();
      const guest = await install(deviceId);

      expect((await post('/currency/checkin', guest.token, deviceId)).status).toBe(200); // +3
      expect((await post('/currency/spin', guest.token, deviceId)).status).toBe(200); // +2
      expect((await post('/currency/paid-spin', guest.token, deviceId)).status).toBe(200); // -3 +2
      const expected = 3 + 3 + 2 - 3 + 2;
      expect(await balanceOf(guest.id)).toBe(expected);

      const reinstalled = await install(deviceId);
      expect(reinstalled.isNewUser).toBe(false);
      expect(reinstalled.id.toString()).toBe(guest.id.toString());
      expect(reinstalled.balance).toBe(expected);

      const me = await get('/me', reinstalled.token);
      expect(me).toMatchObject({ id: guest.id.toString(), creditBalance: expected });
      expect(await ledgerSum(guest.id)).toBe(expected);
      expect(
        await testApp.connection
          .collection('users')
          .countDocuments({ deviceIdHash: deviceHash(deviceId) }),
      ).toBe(1);
    });

    it('keeps a zero balance at zero instead of topping it up', async () => {
      const deviceId = androidId();
      const guest = await install(deviceId);

      await ledger.debit({
        userId: guest.id,
        amount: 3,
        type: CreditTransactionType.READING_SPEND,
      });

      const reinstalled = await install(deviceId);
      expect(reinstalled.id.toString()).toBe(guest.id.toString());
      expect(reinstalled.balance).toBe(0);
      expect(await ledgerSum(guest.id)).toBe(0);
    });
  });

  describe('b. no second starter grant', () => {
    it('keeps one SIGNUP_BONUS and an unchanged devices.starterGrantedAt across reinstalls', async () => {
      const deviceId = androidId();
      const guest = await install(deviceId);

      const before = await deviceDoc(deviceId);
      expect(before?.starterGrantedAt).toBeInstanceOf(Date);
      expect(before?.starterUserId?.toString()).toBe(guest.id.toString());
      expect(await countTx(guest.id, CreditTransactionType.SIGNUP_BONUS)).toBe(1);

      await install(deviceId);
      await install(deviceId);

      const after = await deviceDoc(deviceId);
      expect(after?._id.toString()).toBe(before?._id.toString());
      expect(after?.starterGrantedAt.getTime()).toBe(before?.starterGrantedAt.getTime());
      expect(after?.starterUserId?.toString()).toBe(guest.id.toString());
      expect(await countTx(guest.id, CreditTransactionType.SIGNUP_BONUS)).toBe(1);
      expect(await countTx(guest.id, CreditTransactionType.STARTER)).toBe(0);
      expect(
        await testApp.connection
          .collection('devices')
          .countDocuments({ deviceIdHash: deviceHash(deviceId) }),
      ).toBe(1);
    });
  });

  describe('c. referral stays spent', () => {
    it('keeps devices.referralRedeemedAt and answers 409 REFERRAL_ALREADY_USED on the same guest', async () => {
      const referrer = await install(androidId());
      const otherReferrer = await install(androidId());
      const deviceId = androidId();
      const guest = await install(deviceId);
      const code = await referralCodeOf(referrer.id);

      const first = await post('/me/referral', guest.token, deviceId, { code });
      expect(first.status).toBe(201);
      const redeemed = await deviceDoc(deviceId);
      expect(redeemed?.referralRedeemedAt).toBeInstanceOf(Date);
      expect(redeemed?.referralRedeemedUserId?.toString()).toBe(guest.id.toString());

      const reinstalled = await install(deviceId);
      expect(reinstalled.balance).toBe(8);

      const after = await deviceDoc(deviceId);
      expect(after?.referralRedeemedAt.getTime()).toBe(redeemed?.referralRedeemedAt.getTime());
      expect(after?.referralRedeemedUserId?.toString()).toBe(guest.id.toString());

      // Gate 4 (theo tài khoản) chạy trước Gate 6 (theo thiết bị), nên guest cũ nhận mã lỗi tài khoản.
      for (const retryCode of [code, await referralCodeOf(otherReferrer.id)]) {
        const retry = await post('/me/referral', reinstalled.token, deviceId, { code: retryCode });
        expect(retry.status).toBe(409);
        expect(await errorCodeOf(retry)).toBe('REFERRAL_ALREADY_USED');
      }

      expect(await balanceOf(guest.id)).toBe(8);
      expect(await balanceOf(referrer.id)).toBe(6);
      expect(await balanceOf(otherReferrer.id)).toBe(3);
      expect(
        await testApp.connection.collection('referrals').countDocuments({ refereeId: guest.id }),
      ).toBe(1);
      const me = await get('/me', reinstalled.token);
      expect(me.referral).toEqual({ canEnterCode: false, enteredCode: code });
    });

    it('answers 409 REFERRAL_DEVICE_USED when another account redeems with the same android id', async () => {
      const referrer = await install(androidId());
      const deviceId = androidId();
      const guest = await install(deviceId);
      const code = await referralCodeOf(referrer.id);
      expect((await post('/me/referral', guest.token, deviceId, { code })).status).toBe(201);

      await install(deviceId);

      const other = await seedAccount();
      const res = await post('/me/referral', other.token, deviceId, { code });
      expect(res.status).toBe(409);
      expect(await errorCodeOf(res)).toBe('REFERRAL_DEVICE_USED');
      expect(await balanceOf(other.id)).toBe(3);
    });
  });

  describe('d. daily check-in and free spin', () => {
    it('does not pay check-in or the free spin again on the same day, then does on the next day', async () => {
      const deviceId = androidId();
      const guest = await install(deviceId);

      expect((await post('/currency/checkin', guest.token, deviceId)).status).toBe(200);
      expect((await post('/currency/spin', guest.token, deviceId)).status).toBe(200);
      const balance = await balanceOf(guest.id);

      const reinstalled = await install(deviceId);

      // Check-in là idempotent: trả 200 kèm alreadyClaimed, không phải lỗi.
      const checkin = await post('/currency/checkin', reinstalled.token, deviceId);
      expect(checkin.status).toBe(200);
      expect(await checkin.json()).toMatchObject({
        alreadyClaimed: true,
        milestoneBonus: 0,
        balance,
      });
      expect(await countTx(guest.id, CreditTransactionType.CHECKIN)).toBe(1);

      // Cùng tài khoản nên chặn ở cấp user trước khi xét thiết bị.
      const spin = await post('/currency/spin', reinstalled.token, deviceId);
      expect(spin.status).toBe(409);
      expect(await errorCodeOf(spin)).toBe('free_spin_used');
      expect(await countTx(guest.id, CreditTransactionType.WHEEL)).toBe(1);

      const earn = await get('/currency/earn', reinstalled.token, deviceId);
      expect(earn.checkin.checkedInToday).toBe(true);
      expect(earn.checkin.deviceUsedToday).toBe(false);
      expect(earn.wheel.freeSpinAvailable).toBe(false);
      expect(earn.wheel.freeSpinUsedByDevice).toBe(false);
      expect(await balanceOf(guest.id)).toBe(balance);

      // Đối chứng: chặn theo ngày, không phải khoá hẳn. Chuỗi điểm danh cũng giữ được qua lần cài lại.
      currentNow = new Date(currentNow.getTime() + 24 * 60 * 60 * 1000);
      const nextCheckin = await post('/currency/checkin', reinstalled.token, deviceId);
      expect(nextCheckin.status).toBe(200);
      expect(await nextCheckin.json()).toMatchObject({ alreadyClaimed: false, streakDays: 2 });
      expect((await post('/currency/spin', reinstalled.token, deviceId)).status).toBe(200);
    });

    it('also blocks when the reinstalled app has not sent x-device-id yet', async () => {
      const deviceId = androidId();
      const guest = await install(deviceId);
      expect((await post('/currency/spin', guest.token, deviceId)).status).toBe(200);

      const reinstalled = await install(deviceId);
      const spin = await post('/currency/spin', reinstalled.token);
      expect(spin.status).toBe(409);
      expect(await errorCodeOf(spin)).toBe('free_spin_used');
    });

    it('answers 409 device_used to another account on the same android id', async () => {
      const deviceId = androidId();
      const guest = await install(deviceId);
      expect((await post('/currency/checkin', guest.token, deviceId)).status).toBe(200);
      expect((await post('/currency/spin', guest.token, deviceId)).status).toBe(200);

      await install(deviceId);

      const other = await seedAccount();
      const checkin = await post('/currency/checkin', other.token, deviceId);
      expect(checkin.status).toBe(409);
      expect(await errorCodeOf(checkin)).toBe('device_used');

      const spin = await post('/currency/spin', other.token, deviceId);
      expect(spin.status).toBe(409);
      expect(await errorCodeOf(spin)).toBe('device_used');
      expect(await balanceOf(other.id)).toBe(3);
    });
  });

  describe('e. guest deleted by users:delete, then the device returns', () => {
    const reopen = async (deviceId: string) => {
      const res = await openApp(deviceId);
      expect(res.status).toBe(200);
      return (await res.json()) as any;
    };
    const liveUsers = (deviceId: string) =>
      testApp.connection
        .collection('users')
        .find({ deviceIdHash: deviceHash(deviceId), deletedAt: null })
        .toArray();

    it('opens a new guest: no starter, no referral, old data untouched, device marks kept', async () => {
      const referrer = await install(androidId());
      const deviceId = androidId();
      const guest = await install(deviceId);
      const code = await referralCodeOf(referrer.id);
      expect((await post('/me/referral', guest.token, deviceId, { code })).status).toBe(201);
      expect((await post('/currency/checkin', guest.token, deviceId)).status).toBe(200);
      const deviceBefore = await deviceDoc(deviceId);

      const result = await deleteUserAccount(
        testApp.connection,
        guest.id,
        'Guest reinstall test',
        IDENTITY_SECRET,
      );
      expect(result.identitiesRecorded).toBe(0);

      const body = await reopen(deviceId);
      expect(body.isNewUser).toBe(true);
      expect(body.user.id).not.toBe(guest.id.toString());
      expect(body.user.creditBalance).toBe(0);

      const stored = await liveUsers(deviceId);
      expect(stored).toHaveLength(1);
      expect(stored[0].referralBlocked).toBe(true);
      expect(await countTx(stored[0]._id, CreditTransactionType.SIGNUP_BONUS)).toBe(0);

      const old = await testApp.connection.collection('users').findOne({ _id: guest.id });
      expect(old?.deletedAt).toBeInstanceOf(Date);
      expect(old?.deviceIdHash).toBeNull();
      expect(old?.deletedDeviceIdHash).toBe(deviceHash(deviceId));
      expect(await countTx(guest.id, CreditTransactionType.SIGNUP_BONUS)).toBe(1);

      const deviceAfter = await deviceDoc(deviceId);
      expect(deviceAfter?.starterGrantedAt.getTime()).toBe(deviceBefore?.starterGrantedAt.getTime());
      expect(deviceAfter?.referralRedeemedAt.getTime()).toBe(
        deviceBefore?.referralRedeemedAt.getTime(),
      );
      expect(deviceAfter?.checkinDay).toBe(deviceBefore?.checkinDay);
    });

    it('new guest gets REFERRAL_NOT_ALLOWED and no second check-in on the same day', async () => {
      const referrer = await install(androidId());
      const deviceId = androidId();
      const guest = await install(deviceId);
      expect((await post('/currency/checkin', guest.token, deviceId)).status).toBe(200);
      await deleteUserAccount(testApp.connection, guest.id, 'Guest reinstall test', IDENTITY_SECRET);

      const body = await reopen(deviceId);
      const code = await referralCodeOf(referrer.id);

      const entered = await post('/me/referral', body.accessToken, deviceId, { code });
      expect(entered.status).toBe(403);
      expect(await errorCodeOf(entered)).toBe('REFERRAL_NOT_ALLOWED');

      await post('/currency/checkin', body.accessToken, deviceId);
      const stored = await liveUsers(deviceId);
      expect(stored[0].creditBalance).toBe(0);
    });

    it('keeps a pre-marking redemption spent when the deleted guest gives up the hash', async () => {
      const referrer = await install(androidId());
      const deviceId = androidId();
      const guest = await install(deviceId);
      await testApp.connection.collection('referrals').insertOne({
        referrerId: referrer.id,
        refereeId: guest.id,
        codeUsed: await referralCodeOf(referrer.id),
        status: ReferralStatus.REWARDED,
        createdAt: new Date(),
      });
      expect((await deviceDoc(deviceId))?.referralRedeemedAt ?? null).toBeNull();
      await deleteUserAccount(testApp.connection, guest.id, 'Guest reinstall test', IDENTITY_SECRET);

      await reopen(deviceId);

      const device = await deviceDoc(deviceId);
      expect(device?.referralRedeemedAt).toBeInstanceOf(Date);
      expect(device?.referralRedeemedUserId.toString()).toBe(guest.id.toString());
    });

    it('reopening the same device returns that new guest instead of creating more', async () => {
      const deviceId = androidId();
      const guest = await install(deviceId);
      await deleteUserAccount(testApp.connection, guest.id, 'Guest reinstall test', IDENTITY_SECRET);

      const first = await reopen(deviceId);
      const second = await reopen(deviceId);

      expect(second.isNewUser).toBe(false);
      expect(second.user.id).toBe(first.user.id);
      expect(await liveUsers(deviceId)).toHaveLength(1);
    });

    it('a second deletion on the same device still works and stays without starter', async () => {
      const deviceId = androidId();
      const guest = await install(deviceId);
      await deleteUserAccount(testApp.connection, guest.id, 'Guest reinstall test', IDENTITY_SECRET);
      const second = await reopen(deviceId);

      await deleteUserAccount(
        testApp.connection,
        second.user.id,
        'Guest reinstall test',
        IDENTITY_SECRET,
      );
      const third = await reopen(deviceId);

      expect(third.isNewUser).toBe(true);
      expect(third.user.id).not.toBe(second.user.id);
      expect(third.user.creditBalance).toBe(0);
      const stored = await liveUsers(deviceId);
      expect(stored).toHaveLength(1);
      expect(stored[0].referralBlocked).toBe(true);
    });

    it('concurrent reopen after deletion creates exactly one new guest', async () => {
      const deviceId = androidId();
      const guest = await install(deviceId);
      await deleteUserAccount(testApp.connection, guest.id, 'Guest reinstall test', IDENTITY_SECRET);

      const results = await Promise.all([openApp(deviceId), openApp(deviceId), openApp(deviceId)]);
      expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
      const bodies = (await Promise.all(results.map((r) => r.json()))) as any[];

      expect(new Set(bodies.map((b) => b.user.id)).size).toBe(1);
      expect(await liveUsers(deviceId)).toHaveLength(1);
    });
  });
});
