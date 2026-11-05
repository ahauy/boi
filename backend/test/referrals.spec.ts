import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { CreditTransactionType, ReferralStatus } from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { hashIp } from '../src/common/client-ip.util';
import { computeDeviceIdHash } from '../src/common/device-id-hash.util';
import { CreditLedgerService } from '../src/credits/credit-ledger.service';
import type { GoogleProfile } from '../src/auth/google-auth.verifier';
import { startOfReferralDay } from '../src/referrals/referral-day.util';
import { Device } from '../src/schemas/device.schema';
import { Referral } from '../src/schemas/referral.schema';

const JWT_SECRET = 'test-jwt-secret-palm-sight-at-least-32-chars-long';
const IDENTITY_SECRET = 'test-identity-secret-at-least-32-chars-long';

const referrerGoogleProfile: GoogleProfile = {
  sub: 'google-sub-referrer',
  email: 'referrer.user@example.com',
  emailVerified: true,
  name: 'Referrer User',
  picture: null,
};

describe('US-REF-001: GET /api/v1/me/referrals', () => {
  let testApp: TestAppInstance;
  let accessToken: string;
  let referrerId: Types.ObjectId;

  const getReferrals = (query = '', token?: string) =>
    fetch(`${testApp.baseUrl}/api/v1/me/referrals${query ? `?${query}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    testApp = await createTestApp({
      googleVerifier: { verify: async () => referrerGoogleProfile },
    });

    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'any' }),
    });
    const body = (await res.json()) as any;
    accessToken = body.accessToken;
    referrerId = new Types.ObjectId(body.user.id);
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('returns empty items, totalRewarded: 0, totalCreditsEarned: 0, nextCursor: null when no referrals', async () => {
    const res = await getReferrals('', accessToken);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body).toEqual({
      totalRewarded: 0,
      totalCreditsEarned: 0,
      items: [],
      nextCursor: null,
    });
  });

  it('returns list of referrals with masked displayNames, correct status, creditsEarned, totalRewarded, totalCreditsEarned', async () => {
    // Create referees
    const referee1Id = new Types.ObjectId();
    const referee2Id = new Types.ObjectId();
    const referee3Id = new Types.ObjectId();
    const referee4Id = new Types.ObjectId();

    await testApp.connection.collection('users').insertMany([
      {
        _id: referee1Id,
        displayName: 'Lê Cúc',
        email: 'lecuc@example.com',
        creditBalance: 3,
        referralCode: 'REF00001',
        referralBlocked: false,
        identities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        _id: referee2Id,
        displayName: 'Phạm Dũng',
        email: 'phamdung@example.com',
        creditBalance: 3,
        referralCode: 'REF00002',
        referralBlocked: false,
        identities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        _id: referee3Id,
        displayName: 'John Doe',
        email: 'johndoe@example.com',
        creditBalance: 3,
        referralCode: 'REF00003',
        referralBlocked: false,
        identities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      {
        _id: referee4Id,
        displayName: 'Alice',
        email: 'alice@example.com',
        creditBalance: 3,
        referralCode: 'REF00004',
        referralBlocked: false,
        identities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ]);

    // Insert referrals
    const ref1Id = new Types.ObjectId();
    const ref2Id = new Types.ObjectId();
    const ref3Id = new Types.ObjectId();
    const ref4Id = new Types.ObjectId();

    await testApp.connection.collection('referrals').insertMany([
      {
        _id: ref1Id,
        referrerId,
        refereeId: referee1Id,
        codeUsed: 'REFERRER1',
        status: ReferralStatus.REWARDED,
        createdAt: new Date('2026-10-12T02:10:00.000Z'),
      },
      {
        _id: ref2Id,
        referrerId,
        refereeId: referee2Id,
        codeUsed: 'REFERRER1',
        status: ReferralStatus.CAPPED,
        createdAt: new Date('2026-10-13T09:00:00.000Z'),
      },
      {
        _id: ref3Id,
        referrerId,
        refereeId: referee3Id,
        codeUsed: 'REFERRER1',
        status: ReferralStatus.REWARDED,
        createdAt: new Date('2026-10-14T10:00:00.000Z'),
      },
      {
        _id: ref4Id,
        referrerId,
        refereeId: referee4Id,
        codeUsed: 'REFERRER1',
        status: ReferralStatus.REWARDED,
        createdAt: new Date('2026-10-15T11:00:00.000Z'),
      },
    ]);

    const res = await getReferrals('', accessToken);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.totalRewarded).toBe(3);
    expect(body.totalCreditsEarned).toBe(6);
    expect(body.items).toHaveLength(4);

    // Sorted newest first by _id
    expect(body.items[0]).toEqual({
      displayName: 'A***',
      status: ReferralStatus.REWARDED,
      creditsEarned: 2,
      createdAt: '2026-10-15T11:00:00.000Z',
    });
    expect(body.items[1]).toEqual({
      displayName: 'John D***',
      status: ReferralStatus.REWARDED,
      creditsEarned: 2,
      createdAt: '2026-10-14T10:00:00.000Z',
    });
    expect(body.items[2]).toEqual({
      displayName: 'Phạm D***',
      status: ReferralStatus.CAPPED,
      creditsEarned: 0,
      createdAt: '2026-10-13T09:00:00.000Z',
    });
    expect(body.items[3]).toEqual({
      displayName: 'Lê C***',
      status: ReferralStatus.REWARDED,
      creditsEarned: 2,
      createdAt: '2026-10-12T02:10:00.000Z',
    });
    expect(body.nextCursor).toBeNull();
  });

  it('handles deleted referee (deletedAt != null or missing user doc) by showing "Người dùng đã xoá" without error', async () => {
    const deletedRefereeId = new Types.ObjectId();
    const missingRefereeId = new Types.ObjectId();

    await testApp.connection.collection('users').insertOne({
      _id: deletedRefereeId,
      displayName: 'Soft Deleted User',
      email: 'deleted@example.com',
      creditBalance: 3,
      referralCode: 'REF00DEL',
      referralBlocked: false,
      identities: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(),
    });

    const refDeletedId = new Types.ObjectId();
    const refMissingId = new Types.ObjectId();

    await testApp.connection.collection('referrals').insertMany([
      {
        _id: refDeletedId,
        referrerId,
        refereeId: deletedRefereeId,
        codeUsed: 'REFERRER1',
        status: ReferralStatus.REWARDED,
        createdAt: new Date('2026-10-16T12:00:00.000Z'),
      },
      {
        _id: refMissingId,
        referrerId,
        refereeId: missingRefereeId,
        codeUsed: 'REFERRER1',
        status: ReferralStatus.REWARDED,
        createdAt: new Date('2026-10-17T13:00:00.000Z'),
      },
    ]);

    const res = await getReferrals('', accessToken);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    const missingItem = body.items.find((i: any) => i.createdAt === '2026-10-17T13:00:00.000Z');
    const deletedItem = body.items.find((i: any) => i.createdAt === '2026-10-16T12:00:00.000Z');

    expect(missingItem.displayName).toBe('Người dùng đã xoá');
    expect(deletedItem.displayName).toBe('Người dùng đã xoá');
  });

  it('supports cursor pagination: handles limit and cursor accurately', async () => {
    // We currently have 6 referrals in the database for referrerId
    const res1 = await getReferrals('limit=2', accessToken);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as any;

    expect(body1.items).toHaveLength(2);
    expect(body1.nextCursor).not.toBeNull();
    expect(body1.totalRewarded).toBe(5); // 3 original + 2 new REWARDED
    expect(body1.totalCreditsEarned).toBe(10); // 5 * 2

    // Fetch page 2 using cursor
    const res2 = await getReferrals(`cursor=${body1.nextCursor}&limit=2`, accessToken);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as any;

    expect(body2.items).toHaveLength(2);
    expect(body2.nextCursor).not.toBeNull();
    expect(body2.items[0]).not.toEqual(body1.items[0]);
    expect(body2.items[1]).not.toEqual(body1.items[1]);

    // Fetch page 3 using cursor
    const res3 = await getReferrals(`cursor=${body2.nextCursor}&limit=2`, accessToken);
    expect(res3.status).toBe(200);
    const body3 = (await res3.json()) as any;

    expect(body3.items).toHaveLength(2);
    expect(body3.nextCursor).toBeNull();
  });

  it('invalid cursor throws 400 VALIDATION_ERROR', async () => {
    const res = await getReferrals('cursor=invalid-not-an-objectid', accessToken);
    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Cursor phân trang không hợp lệ.',
        details: {
          fields: [{ field: 'cursor', message: 'Cursor phải là ObjectId hợp lệ' }],
        },
      },
    });
  });

  it('missing or forged token throws 401 UNAUTHENTICATED', async () => {
    // Missing token
    const resMissing = await getReferrals();
    expect(resMissing.status).toBe(401);
    const bodyMissing = (await resMissing.json()) as any;
    expect(bodyMissing.error.code).toBe('UNAUTHENTICATED');

    // Forged token
    const forgedToken = new JwtService({ secret: 'some-wrong-jwt-secret-string-32-chars' }).sign({
      sub: referrerId.toString(),
      sid: 'mock-session-id',
    });
    const resForged = await getReferrals('', forgedToken);
    expect(resForged.status).toBe(401);
    const bodyForged = (await resForged.json()) as any;
    expect(bodyForged.error.code).toBe('UNAUTHENTICATED');

    // Expired token
    const expiredToken = new JwtService({ secret: JWT_SECRET }).sign(
      { sub: referrerId.toString(), sid: 'mock-session-id' },
      { expiresIn: -10 },
    );
    const resExpired = await getReferrals('', expiredToken);
    expect(resExpired.status).toBe(401);
    const bodyExpired = (await resExpired.json()) as any;
    expect(bodyExpired.error.code).toBe('TOKEN_EXPIRED');
  });

  it('token of user with deletedAt != null throws 401 UNAUTHENTICATED', async () => {
    await testApp.connection
      .collection('users')
      .updateOne({ _id: referrerId }, { $set: { deletedAt: new Date() } });

    const res = await getReferrals('', accessToken);
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('maskDisplayName utility', () => {
  it('correctly masks various formats according to privacy rules', async () => {
    const { maskDisplayName } = await import('../src/referrals/mask-display-name.util');

    expect(maskDisplayName('Lê Cúc')).toBe('Lê C***');
    expect(maskDisplayName('Phạm Dũng')).toBe('Phạm D***');
    expect(maskDisplayName('John Doe')).toBe('John D***');
    expect(maskDisplayName('Alice')).toBe('A***');
    expect(maskDisplayName('Nguyễn Văn A')).toBe('Nguyễn Văn A***');
    expect(maskDisplayName('A')).toBe('A***');
    expect(maskDisplayName('   Lê    Cúc   ')).toBe('Lê C***');
    expect(maskDisplayName('')).toBe('***');
  });
});

describe('startOfReferralDay', () => {
  it('rolls over at 17:00 UTC, which is midnight in Vietnam', () => {
    expect(startOfReferralDay(new Date('2026-11-04T16:59:59.999Z')).toISOString()).toBe(
      '2026-11-03T17:00:00.000Z',
    );
    expect(startOfReferralDay(new Date('2026-11-04T17:00:00.000Z')).toISOString()).toBe(
      '2026-11-04T17:00:00.000Z',
    );
  });
});

describe('US-REF-002: POST /api/v1/me/referral', () => {
  let testApp: TestAppInstance;
  const jwtService = new JwtService({ secret: JWT_SECRET });

  const createToken = (userId: Types.ObjectId) =>
    jwtService.sign({ sub: userId.toString(), sid: 'test-session-id' });

  const enterReferral = (
    token: string | null,
    body: unknown,
    deviceId?: string,
    headers: Record<string, string> = {},
  ) =>
    fetch(`${testApp.baseUrl}/api/v1/me/referral`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(deviceId ? { 'x-device-id': deviceId } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
    });

  const seedRewardedToday = (referrerId: Types.ObjectId, code: string, count: number) =>
    testApp.connection.collection('referrals').insertMany(
      Array.from({ length: count }).map(() => ({
        _id: new Types.ObjectId(),
        referrerId,
        refereeId: new Types.ObjectId(),
        codeUsed: code,
        status: ReferralStatus.REWARDED,
        createdAt: new Date(startOfReferralDay().getTime() + 1000 * 60),
      })),
    );

  const generateValidCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const seedUser = async (overrides: Record<string, unknown> = {}) => {
    const id = new Types.ObjectId();
    const referralCode =
      (overrides.referralCode as string) || generateValidCode();
    const doc = {
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
      ...overrides,
    };
    await testApp.connection.collection('users').insertOne(doc);
    return doc;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    // autoIndex tắt: các ca đồng thời cần unique index như production.
    await testApp.connection.model(Referral.name).syncIndexes();
    await testApp.connection.model(Device.name).syncIndexes();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('successful referral redemption when under daily cap: status REWARDED, referee +5, referrer +3, returns 201', async () => {
    const referrer = await seedUser({
      displayName: 'Nguyễn Văn Chủ Mã',
      referralCode: 'K7QX4MZP',
      creditBalance: 3,
    });
    const referee = await seedUser({
      displayName: 'Trần Văn Người Nhập',
      creditBalance: 3,
    });
    const token = createToken(referee._id);

    // Test lowercase code with leading/trailing whitespace
    const res = await enterReferral(token, { code: '  k7qx4mzp  ' });
    expect(res.status).toBe(201);

    const body = (await res.json()) as any;
    expect(body).toEqual({
      accepted: true,
      referrer: { displayName: 'Nguyễn Văn Chủ Mã' },
      creditsEarned: 5,
      creditBalance: 8,
    });

    // Check referral record in DB
    const referralRecord = await testApp.connection
      .collection('referrals')
      .findOne({ refereeId: referee._id });
    expect(referralRecord).toBeDefined();
    expect(referralRecord?.referrerId.toString()).toBe(referrer._id.toString());
    expect(referralRecord?.codeUsed).toBe('K7QX4MZP');
    expect(referralRecord?.status).toBe(ReferralStatus.REWARDED);
    expect(referralRecord?.referrerReward).toBe(3);

    // Check referee updated credit balance
    const updatedReferee = await testApp.connection
      .collection('users')
      .findOne({ _id: referee._id });
    expect(updatedReferee?.creditBalance).toBe(8);

    // Check referrer updated credit balance
    const updatedReferrer = await testApp.connection
      .collection('users')
      .findOne({ _id: referrer._id });
    expect(updatedReferrer?.creditBalance).toBe(6);

    // Check credit ledger transactions
    const refereeTx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: referee._id, type: 'REFEREE_BONUS' });
    expect(refereeTx).toBeDefined();
    expect(refereeTx?.amount).toBe(5);
    expect(refereeTx?.balanceAfter).toBe(8);
    expect(refereeTx?.referralId.toString()).toBe(referralRecord?._id.toString());

    const referrerTx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: referrer._id, type: 'REFERRAL_BONUS' });
    expect(referrerTx).toBeDefined();
    expect(referrerTx?.amount).toBe(3);
    expect(referrerTx?.balanceAfter).toBe(6);
    expect(referrerTx?.referralId.toString()).toBe(referralRecord?._id.toString());
  });

  it('successful referral redemption when daily cap reached (5 REWARDED referrals today): status CAPPED, referee +5, referrer +0, returns 201', async () => {
    const referrer = await seedUser({
      displayName: 'Chủ Mã Max Cap',
      referralCode: 'CAP29MAX',
      creditBalance: 23,
    });

    await seedRewardedToday(referrer._id, 'CAP29MAX', 5);

    const referee = await seedUser({ creditBalance: 3 });
    const token = createToken(referee._id);

    const res = await enterReferral(token, { code: 'CAP29MAX' });
    expect(res.status).toBe(201);

    const body = (await res.json()) as any;
    expect(body).toEqual({
      accepted: true,
      referrer: { displayName: 'Chủ Mã Max Cap' },
      creditsEarned: 5,
      creditBalance: 8,
    });

    // Check referral record has status CAPPED
    const referralRecord = await testApp.connection
      .collection('referrals')
      .findOne({ refereeId: referee._id });
    expect(referralRecord?.status).toBe(ReferralStatus.CAPPED);
    expect(referralRecord?.referrerReward).toBe(0);

    // Referee got +5 GEM
    const updatedReferee = await testApp.connection
      .collection('users')
      .findOne({ _id: referee._id });
    expect(updatedReferee?.creditBalance).toBe(8);

    // Referrer credit unchanged
    const updatedReferrer = await testApp.connection
      .collection('users')
      .findOne({ _id: referrer._id });
    expect(updatedReferrer?.creditBalance).toBe(23);

    // Referrer should have NO new transaction
    const referrerTxs = await testApp.connection
      .collection('credit_transactions')
      .find({ userId: referrer._id, referralId: referralRecord?._id })
      .toArray();
    expect(referrerTxs).toHaveLength(0);

    // Referee has transaction
    const refereeTx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: referee._id, referralId: referralRecord?._id });
    expect(refereeTx).toBeDefined();
    expect(refereeTx?.amount).toBe(5);
    expect(refereeTx?.balanceAfter).toBe(8);
  });

  it('concurrent redemptions with one slot left: exactly one is rewarded and everyone still gets +5', async () => {
    const referrer = await seedUser({ referralCode: 'STSEAT22', creditBalance: 0 });
    await seedRewardedToday(referrer._id, 'STSEAT22', 4);
    const users = await Promise.all(
      Array.from({ length: 6 }).map(() => seedUser({ creditBalance: 0 })),
    );

    const results = await Promise.all(
      users.map((u) => enterReferral(createToken(u._id), { code: 'STSEAT22' })),
    );

    expect(results.map((r) => r.status)).toEqual(Array(6).fill(201));

    const referrals = await testApp.connection
      .collection('referrals')
      .find({ refereeId: { $in: users.map((u) => u._id) } })
      .toArray();
    expect(referrals).toHaveLength(6);

    const rewarded = referrals.filter((r) => r.status === ReferralStatus.REWARDED);
    const capped = referrals.filter((r) => r.status === ReferralStatus.CAPPED);
    expect(rewarded).toHaveLength(1);
    expect(rewarded[0].referrerReward).toBe(3);
    expect(capped).toHaveLength(5);
    expect(capped.every((r) => r.referrerReward === 0)).toBe(true);

    const referrerDoc = await testApp.connection
      .collection('users')
      .findOne({ _id: referrer._id });
    expect(referrerDoc?.creditBalance).toBe(3);
    expect(
      await testApp.connection
        .collection('credit_transactions')
        .countDocuments({ userId: referrer._id, type: 'REFERRAL_BONUS' }),
    ).toBe(1);

    const balances = await testApp.connection
      .collection('users')
      .find({ _id: { $in: users.map((u) => u._id) } })
      .toArray();
    expect(balances.map((u) => u.creditBalance)).toEqual(Array(6).fill(5));
  });

  it('double submit from one account: one 201, one 409 REFERRAL_ALREADY_USED, credited once', async () => {
    const referrer = await seedUser({ referralCode: 'DBCKCK22', creditBalance: 0 });
    const user = await seedUser({ creditBalance: 0 });
    const token = createToken(user._id);

    const results = await Promise.all([
      enterReferral(token, { code: 'DBCKCK22' }),
      enterReferral(token, { code: 'DBCKCK22' }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const conflict = results.find((r) => r.status === 409)!;
    expect(((await conflict.json()) as any).error.code).toBe('REFERRAL_ALREADY_USED');

    const users = testApp.connection.collection('users');
    expect((await users.findOne({ _id: user._id }))?.creditBalance).toBe(5);
    expect((await users.findOne({ _id: referrer._id }))?.creditBalance).toBe(3);
    expect(
      await testApp.connection.collection('referrals').countDocuments({ refereeId: user._id }),
    ).toBe(1);
  });

  it('referral history keeps 2 GEM for legacy records and uses stored rewards for new ones', async () => {
    const referrer = await seedUser({ referralCode: 'HSTRY234' });
    await testApp.connection.collection('referrals').insertMany([
      {
        referrerId: referrer._id,
        refereeId: new Types.ObjectId(),
        codeUsed: 'HSTRY234',
        status: ReferralStatus.REWARDED,
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
      },
      {
        referrerId: referrer._id,
        refereeId: new Types.ObjectId(),
        codeUsed: 'HSTRY234',
        status: ReferralStatus.REWARDED,
        referrerReward: 3,
        createdAt: new Date('2026-10-02T00:00:00.000Z'),
      },
      {
        referrerId: referrer._id,
        refereeId: new Types.ObjectId(),
        codeUsed: 'HSTRY234',
        status: ReferralStatus.CAPPED,
        referrerReward: 0,
        createdAt: new Date('2026-10-03T00:00:00.000Z'),
      },
    ]);

    const res = await fetch(`${testApp.baseUrl}/api/v1/me/referrals`, {
      headers: { Authorization: `Bearer ${createToken(referrer._id)}` },
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.totalRewarded).toBe(2);
    expect(body.totalCreditsEarned).toBe(5);
    expect(body.items.map((item: any) => item.creditsEarned)).toEqual([0, 3, 2]);
  });

  describe('Gate 6: one redemption per device', () => {
    const deviceHash = (raw: string) => computeDeviceIdHash(IDENTITY_SECRET, raw);
    const balanceOf = async (id: Types.ObjectId) =>
      (await testApp.connection.collection('users').findOne({ _id: id }))?.creditBalance;
    const errorCodeOf = async (res: Response) => ((await res.json()) as any).error.code;

    it('second account on the same device gets 409 REFERRAL_DEVICE_USED with no side effects', async () => {
      const referrer = await seedUser({ referralCode: 'DVCREF22', creditBalance: 0 });
      const first = await seedUser({ creditBalance: 0 });
      const second = await seedUser({ creditBalance: 0 });

      const ok = await enterReferral(createToken(first._id), { code: 'DVCREF22' }, 'device-a');
      expect(ok.status).toBe(201);

      const device = await testApp.connection
        .collection('devices')
        .findOne({ deviceIdHash: deviceHash('device-a') });
      expect(device?.referralRedeemedUserId?.toString()).toBe(first._id.toString());

      const res = await enterReferral(createToken(second._id), { code: 'DVCREF22' }, ' device-a ');
      expect(res.status).toBe(409);
      expect(await errorCodeOf(res)).toBe('REFERRAL_DEVICE_USED');

      expect(await balanceOf(second._id)).toBe(0);
      expect(await balanceOf(referrer._id)).toBe(3);
      expect(
        await testApp.connection.collection('referrals').findOne({ refereeId: second._id }),
      ).toBeNull();
    });

    it('guest cannot escape by changing the header: the account device identity wins', async () => {
      await seedUser({ referralCode: 'GSTREF22' });
      const guest = await seedUser({ deviceIdHash: deviceHash('guest-device') });
      const ok = await enterReferral(createToken(guest._id), { code: 'GSTREF22' }, 'spoofed-1');
      expect(ok.status).toBe(201);

      const devices = testApp.connection.collection('devices');
      const guestDevice = await devices.findOne({ deviceIdHash: deviceHash('guest-device') });
      expect(guestDevice?.referralRedeemedUserId?.toString()).toBe(guest._id.toString());
      const spoofedDevice = await devices.findOne({ deviceIdHash: deviceHash('spoofed-1') });
      expect(spoofedDevice?.referralRedeemedAt ?? null).toBeNull();

      const emailUser = await seedUser();
      const res = await enterReferral(createToken(emailUser._id), { code: 'GSTREF22' }, 'guest-device');
      expect(res.status).toBe(409);
      expect(await errorCodeOf(res)).toBe('REFERRAL_DEVICE_USED');
    });

    it('blocks a device whose guest owner redeemed before device marking existed', async () => {
      await seedUser({ referralCode: 'GCYREF22' });
      const legacyGuest = await seedUser({ deviceIdHash: deviceHash('legacy-device') });
      await testApp.connection.collection('referrals').insertOne({
        referrerId: new Types.ObjectId(),
        refereeId: legacyGuest._id,
        codeUsed: 'GCYREF22',
        status: ReferralStatus.REWARDED,
        createdAt: new Date(),
      });

      const other = await seedUser();
      const res = await enterReferral(createToken(other._id), { code: 'GCYREF22' }, 'legacy-device');
      expect(res.status).toBe(409);
      expect(await errorCodeOf(res)).toBe('REFERRAL_DEVICE_USED');
    });

    it('concurrent accounts on one device: exactly one is rewarded', async () => {
      const referrer = await seedUser({ referralCode: 'RCEREF22', creditBalance: 0 });
      const users = await Promise.all([seedUser(), seedUser(), seedUser()]);

      const results = await Promise.all(
        users.map((u) =>
          enterReferral(createToken(u._id), { code: 'RCEREF22' }, 'race-device'),
        ),
      );

      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
      const rejected = results.filter((r) => r.status === 409);
      expect(await Promise.all(rejected.map(errorCodeOf))).toEqual([
        'REFERRAL_DEVICE_USED',
        'REFERRAL_DEVICE_USED',
      ]);
      expect(await balanceOf(referrer._id)).toBe(3);
      expect(
        await testApp.connection
          .collection('referrals')
          .countDocuments({ referrerId: referrer._id }),
      ).toBe(1);
    });

    it('a legacy device document without referralRedeemedAt can still be claimed', async () => {
      await seedUser({ referralCode: 'GACYRF22' });
      const user = await seedUser();
      const devices = testApp.connection.collection('devices');
      await devices.insertOne({ deviceIdHash: deviceHash('legacy-doc'), createdAt: new Date() });

      const res = await enterReferral(createToken(user._id), { code: 'GACYRF22' }, 'legacy-doc');
      expect(res.status).toBe(201);

      const device = await devices.findOne({ deviceIdHash: deviceHash('legacy-doc') });
      expect(device?.referralRedeemedUserId?.toString()).toBe(user._id.toString());
    });

    it('a failure after the device mark rolls everything back so the device can retry', async () => {
      const referrer = await seedUser({ referralCode: 'RBKREF22', creditBalance: 0 });
      const user = await seedUser({ creditBalance: 0 });
      const token = createToken(user._id);

      const ledger = testApp.app.get(CreditLedgerService);
      const realCredit = ledger.credit.bind(ledger);
      const spy = vi
        .spyOn(ledger, 'credit')
        .mockImplementation(async (input: any, session: any) => {
          if (input.type === CreditTransactionType.REFERRAL_BONUS) {
            throw new Error('ledger down');
          }
          return realCredit(input, session);
        });

      const failed = await enterReferral(token, { code: 'RBKREF22' }, 'retry-device');
      spy.mockRestore();
      expect(failed.status).toBe(500);

      expect(await balanceOf(user._id)).toBe(0);
      expect(
        await testApp.connection.collection('referrals').findOne({ refereeId: user._id }),
      ).toBeNull();
      const device = await testApp.connection
        .collection('devices')
        .findOne({ deviceIdHash: deviceHash('retry-device') });
      expect(device?.referralRedeemedAt ?? null).toBeNull();

      const retried = await enterReferral(token, { code: 'RBKREF22' }, 'retry-device');
      expect(retried.status).toBe(201);
      expect(await balanceOf(user._id)).toBe(5);
      expect(await balanceOf(referrer._id)).toBe(3);
    });

    it('no device identity: redemption still works and stays limited per account', async () => {
      await seedUser({ referralCode: 'NDVREF22' });
      await seedUser({ referralCode: 'NDVREF33' });
      const user = await seedUser();
      const token = createToken(user._id);

      expect((await enterReferral(token, { code: 'NDVREF22' })).status).toBe(201);
      const res = await enterReferral(token, { code: 'NDVREF33' });
      expect(res.status).toBe(409);
      expect(await errorCodeOf(res)).toBe('REFERRAL_ALREADY_USED');
    });
  });

  describe('network limit', () => {
    const fromIp = (ip: string, extra: Record<string, string> = {}) => ({
      'cf-connecting-ip': ip,
      ...extra,
    });
    const counterOf = (ip: string) =>
      testApp.connection
        .collection('referral_network_counters')
        .findOne({ ipHash: hashIp(ip), day: startOfReferralDay() });
    const balanceOf = async (id: Types.ObjectId) =>
      (await testApp.connection.collection('users').findOne({ _id: id }))?.creditBalance;

    it('the 6th redemption on a network gets 429 with no side effects and another network still works', async () => {
      const ip = '203.0.113.10';
      const referrer = await seedUser({ referralCode: 'NETREF22', creditBalance: 0 });
      for (let i = 0; i < 5; i++) {
        const user = await seedUser();
        const ok = await enterReferral(createToken(user._id), { code: 'NETREF22' }, undefined, fromIp(ip));
        expect(ok.status).toBe(201);
      }

      const sixth = await seedUser({ creditBalance: 0 });
      const token = createToken(sixth._id);
      // X-Forwarded-For do client gửi không được đổi mạng.
      const blocked = await enterReferral(
        token,
        { code: 'NETREF22' },
        'net-device',
        fromIp(ip, { 'x-forwarded-for': '198.51.100.99' }),
      );
      expect(blocked.status).toBe(429);
      expect(((await blocked.json()) as any).error.code).toBe('REFERRAL_NETWORK_LIMIT');

      expect(await balanceOf(sixth._id)).toBe(0);
      expect(await balanceOf(referrer._id)).toBe(15);
      expect(
        await testApp.connection.collection('referrals').findOne({ refereeId: sixth._id }),
      ).toBeNull();
      expect(
        await testApp.connection.collection('credit_transactions').findOne({ userId: sixth._id }),
      ).toBeNull();
      const device = await testApp.connection
        .collection('devices')
        .findOne({ deviceIdHash: computeDeviceIdHash(IDENTITY_SECRET, 'net-device') });
      expect(device?.referralRedeemedAt ?? null).toBeNull();
      expect((await counterOf(ip))?.count).toBe(5);

      const other = await enterReferral(token, { code: 'NETREF22' }, 'net-device', fromIp('203.0.113.11'));
      expect(other.status).toBe(201);
      expect(await balanceOf(sixth._id)).toBe(5);
    });

    it('concurrent redemptions for different referrers on one network never pass the cap', async () => {
      const ip = '203.0.113.20';
      const pairs = await Promise.all(
        Array.from({ length: 8 }).map(async () => ({
          referrer: await seedUser({ creditBalance: 0 }),
          user: await seedUser({ creditBalance: 0 }),
        })),
      );

      const results = await Promise.all(
        pairs.map(({ referrer, user }) =>
          enterReferral(createToken(user._id), { code: referrer.referralCode }, undefined, fromIp(ip)),
        ),
      );

      expect(results.map((r) => r.status).sort()).toEqual([201, 201, 201, 201, 201, 429, 429, 429]);
      expect((await counterOf(ip))?.count).toBe(5);
      expect(
        await testApp.connection.collection('referrals').countDocuments({
          refereeId: { $in: pairs.map((p) => p.user._id) },
        }),
      ).toBe(5);
    });

    it('a rolled back redemption gives its slot back', async () => {
      const ip = '203.0.113.30';
      await seedUser({ referralCode: 'NETRBK22' });
      const user = await seedUser();

      const ledger = testApp.app.get(CreditLedgerService);
      const realCredit = ledger.credit.bind(ledger);
      const spy = vi
        .spyOn(ledger, 'credit')
        .mockImplementation(async (input: any, session: any) => {
          if (input.type === CreditTransactionType.REFERRAL_BONUS) {
            throw new Error('ledger down');
          }
          return realCredit(input, session);
        });

      const failed = await enterReferral(createToken(user._id), { code: 'NETRBK22' }, undefined, fromIp(ip));
      spy.mockRestore();
      expect(failed.status).toBe(500);
      expect((await counterOf(ip))?.count).toBe(0);
    });

    it('a proxy list counts against its first entry', async () => {
      const ip = '203.0.113.70';
      await seedUser({ referralCode: 'NETPST22' });
      const user = await seedUser();

      const res = await enterReferral(
        createToken(user._id),
        { code: 'NETPST22' },
        undefined,
        fromIp(`${ip}, 10.0.0.1`),
      );
      expect(res.status).toBe(201);
      expect((await counterOf(ip))?.count).toBe(1);
    });

    it('an internal address is treated as no IP instead of one shared network', async () => {
      const ip = '10.20.30.40';
      await seedUser({ referralCode: 'NETNTR22' });
      const user = await seedUser();

      const res = await enterReferral(createToken(user._id), { code: 'NETNTR22' }, undefined, fromIp(ip));
      expect(res.status).toBe(201);
      expect(await counterOf(ip)).toBeNull();
    });
  });

  it('Gate 1 failure: user with referralBlocked = true throws 403 REFERRAL_NOT_ALLOWED', async () => {
    await seedUser({ referralCode: 'BKCKTEST' });
    const blockedUser = await seedUser({ referralBlocked: true });
    const token = createToken(blockedUser._id);

    const res = await enterReferral(token, { code: 'BKCKTEST' });
    expect(res.status).toBe(403);

    const body = (await res.json()) as any;
    expect(body.error.code).toBe('REFERRAL_NOT_ALLOWED');

    // Gate 1 precedes Gate 2: even with non-existent/invalid code, blocked user gets 403
    const resInvalidCode = await enterReferral(token, { code: 'NOT_EXIST' });
    expect(resInvalidCode.status).toBe(403);
    const bodyInvalidCode = (await resInvalidCode.json()) as any;
    expect(bodyInvalidCode.error.code).toBe('REFERRAL_NOT_ALLOWED');
  });

  it('Gate 2 failure: non-existent code or regex mismatch throws 404 REFERRAL_CODE_NOT_FOUND', async () => {
    const user = await seedUser();
    const token = createToken(user._id);

    // Regex mismatch: length != 8 or invalid characters
    const resRegex = await enterReferral(token, { code: 'SHORT' });
    expect(resRegex.status).toBe(404);
    const bodyRegex = (await resRegex.json()) as any;
    expect(bodyRegex.error.code).toBe('REFERRAL_CODE_NOT_FOUND');

    // Regex mismatch: contains lowercase invalid or symbols
    const resInvalidChars = await enterReferral(token, { code: 'INVALID!' });
    expect(resInvalidChars.status).toBe(404);
    const bodyInvalidChars = (await resInvalidChars.json()) as any;
    expect(bodyInvalidChars.error.code).toBe('REFERRAL_CODE_NOT_FOUND');

    // Matches regex format (8 base32 chars) but code does not exist in DB
    const resNotFound = await enterReferral(token, { code: 'ZZZZZZZZ' });
    expect(resNotFound.status).toBe(404);
    const bodyNotFound = (await resNotFound.json()) as any;
    expect(bodyNotFound.error.code).toBe('REFERRAL_CODE_NOT_FOUND');

    // Referrer exists but is soft-deleted (deletedAt != null)
    await seedUser({
      referralCode: 'D7REF999',
      deletedAt: new Date(),
    });
    const resDeleted = await enterReferral(token, { code: 'D7REF999' });
    expect(resDeleted.status).toBe(404);
    const bodyDeleted = (await resDeleted.json()) as any;
    expect(bodyDeleted.error.code).toBe('REFERRAL_CODE_NOT_FOUND');
  });

  it('Gate 3 failure: entering own code throws 422 REFERRAL_SELF', async () => {
    const user = await seedUser({ referralCode: 'S2KFRF22' });
    const token = createToken(user._id);

    const res = await enterReferral(token, { code: 'S2KFRF22' });
    expect(res.status).toBe(422);

    const body = (await res.json()) as any;
    expect(body.error.code).toBe('REFERRAL_SELF');
  });

  it('Gate 4 failure: user who already redeemed a referral throws 409 REFERRAL_ALREADY_USED', async () => {
    await seedUser({ referralCode: 'REFQNE99' });
    await seedUser({ referralCode: 'REFTWQ88' });
    const referee = await seedUser();
    const token = createToken(referee._id);

    // Redeem first referral successfully
    const res1 = await enterReferral(token, { code: 'REFQNE99' });
    expect(res1.status).toBe(201);

    // Attempt second referral
    const res2 = await enterReferral(token, { code: 'REFTWQ88' });
    expect(res2.status).toBe(409);

    const body = (await res2.json()) as any;
    expect(body.error.code).toBe('REFERRAL_ALREADY_USED');
  });

  it('Gate 5 failure: entering code of someone the user already referred throws 422 REFERRAL_CYCLE', async () => {
    const userA = await seedUser({ referralCode: 'USERA234' });
    const userB = await seedUser({ referralCode: 'USERB567' });

    // User A already referred User B
    await testApp.connection.collection('referrals').insertOne({
      _id: new Types.ObjectId(),
      referrerId: userA._id,
      refereeId: userB._id,
      codeUsed: 'USERA234',
      status: ReferralStatus.REWARDED,
      createdAt: new Date(),
    });

    // Now User A tries to enter User B's code -> cycle!
    const tokenA = createToken(userA._id);
    const res = await enterReferral(tokenA, { code: 'USERB567' });
    expect(res.status).toBe(422);

    const body = (await res.json()) as any;
    expect(body.error.code).toBe('REFERRAL_CYCLE');
  });

  it('Validation failure: missing code or invalid body throws 400 VALIDATION_ERROR', async () => {
    const user = await seedUser();
    const token = createToken(user._id);

    // Missing code property
    const resMissing = await enterReferral(token, {});
    expect(resMissing.status).toBe(400);
    const bodyMissing = (await resMissing.json()) as any;
    expect(bodyMissing.error.code).toBe('VALIDATION_ERROR');

    // Code is number
    const resNum = await enterReferral(token, { code: 12345678 });
    expect(resNum.status).toBe(400);
    const bodyNum = (await resNum.json()) as any;
    expect(bodyNum.error.code).toBe('VALIDATION_ERROR');

    // Code is empty string
    const resEmpty = await enterReferral(token, { code: '' });
    expect(resEmpty.status).toBe(400);
    const bodyEmpty = (await resEmpty.json()) as any;
    expect(bodyEmpty.error.code).toBe('VALIDATION_ERROR');

    // Code is whitespace only
    const resSpaces = await enterReferral(token, { code: '   ' });
    expect(resSpaces.status).toBe(400);
    const bodySpaces = (await resSpaces.json()) as any;
    expect(bodySpaces.error.code).toBe('VALIDATION_ERROR');

    // Extra unknown property
    const resUnknown = await enterReferral(token, {
      code: 'K7QX4MZP',
      extraField: 'hacked',
    });
    expect(resUnknown.status).toBe(400);
    const bodyUnknown = (await resUnknown.json()) as any;
    expect(bodyUnknown.error.code).toBe('VALIDATION_ERROR');
  });

  it('Unauthorized: missing or forged token throws 401 UNAUTHENTICATED', async () => {
    const resNoToken = await enterReferral(null, { code: 'ANYCODE1' });
    expect(resNoToken.status).toBe(401);
    const bodyNoToken = (await resNoToken.json()) as any;
    expect(bodyNoToken.error.code).toBe('UNAUTHENTICATED');
  });

  it('Rate limit: exceeding 5 requests/hour throws 429 RATE_LIMITED', async () => {
    const rateLimitedUser = await seedUser();
    const token = createToken(rateLimitedUser._id);

    // Make 5 requests within the window
    for (let i = 0; i < 5; i++) {
      const res = await enterReferral(token, { code: 'ZZZZZZZZ' });
      expect(res.status).toBe(404);
    }

    // 6th request must trigger rate limit
    const resLimited = await enterReferral(token, { code: 'ZZZZZZZZ' });
    expect(resLimited.status).toBe(429);

    const bodyLimited = (await resLimited.json()) as any;
    expect(bodyLimited.error.code).toBe('RATE_LIMITED');
    expect(resLimited.headers.get('Retry-After')).toBeTruthy();
  });
});


