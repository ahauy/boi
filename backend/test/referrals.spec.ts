import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { ReferralStatus } from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import type { GoogleProfile } from '../src/auth/google-auth.verifier';

const JWT_SECRET = 'test-jwt-secret-palm-sight-at-least-32-chars-long';

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

describe('US-REF-002: POST /api/v1/me/referral', () => {
  let testApp: TestAppInstance;
  const jwtService = new JwtService({ secret: JWT_SECRET });

  const createToken = (userId: Types.ObjectId) =>
    jwtService.sign({ sub: userId.toString(), sid: 'test-session-id' });

  const enterReferral = (token: string | null, body: unknown) =>
    fetch(`${testApp.baseUrl}/api/v1/me/referral`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

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
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('successful referral redemption when under daily cap: status REWARDED, referee +1, referrer +2, returns 201', async () => {
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
      creditsEarned: 1,
      creditBalance: 4,
    });

    // Check referral record in DB
    const referralRecord = await testApp.connection
      .collection('referrals')
      .findOne({ refereeId: referee._id });
    expect(referralRecord).toBeDefined();
    expect(referralRecord?.referrerId.toString()).toBe(referrer._id.toString());
    expect(referralRecord?.codeUsed).toBe('K7QX4MZP');
    expect(referralRecord?.status).toBe(ReferralStatus.REWARDED);

    // Check referee updated credit balance
    const updatedReferee = await testApp.connection
      .collection('users')
      .findOne({ _id: referee._id });
    expect(updatedReferee?.creditBalance).toBe(4);

    // Check referrer updated credit balance
    const updatedReferrer = await testApp.connection
      .collection('users')
      .findOne({ _id: referrer._id });
    expect(updatedReferrer?.creditBalance).toBe(5);

    // Check credit ledger transactions
    const refereeTx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: referee._id, type: 'REFEREE_BONUS' });
    expect(refereeTx).toBeDefined();
    expect(refereeTx?.amount).toBe(1);
    expect(refereeTx?.balanceAfter).toBe(4);
    expect(refereeTx?.referralId.toString()).toBe(referralRecord?._id.toString());

    const referrerTx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: referrer._id, type: 'REFERRAL_BONUS' });
    expect(referrerTx).toBeDefined();
    expect(referrerTx?.amount).toBe(2);
    expect(referrerTx?.balanceAfter).toBe(5);
    expect(referrerTx?.referralId.toString()).toBe(referralRecord?._id.toString());
  });

  it('successful referral redemption when daily cap reached (10 REWARDED referrals today): status CAPPED, referee +1, referrer +0, returns 201', async () => {
    const referrer = await seedUser({
      displayName: 'Chủ Mã Max Cap',
      referralCode: 'CAP29MAX',
      creditBalance: 23,
    });

    // Insert 10 rewarded referrals for today (VN time)
    const now = new Date();
    const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const startOfVnDayUtc = new Date(
      Date.UTC(vnTime.getUTCFullYear(), vnTime.getUTCMonth(), vnTime.getUTCDate()) -
        7 * 60 * 60 * 1000,
    );

    const existingReferrals = Array.from({ length: 10 }).map(() => ({
      _id: new Types.ObjectId(),
      referrerId: referrer._id,
      refereeId: new Types.ObjectId(),
      codeUsed: 'CAP29MAX',
      status: ReferralStatus.REWARDED,
      createdAt: new Date(startOfVnDayUtc.getTime() + 1000 * 60),
    }));
    await testApp.connection.collection('referrals').insertMany(existingReferrals);

    const referee = await seedUser({ creditBalance: 3 });
    const token = createToken(referee._id);

    const res = await enterReferral(token, { code: 'CAP29MAX' });
    expect(res.status).toBe(201);

    const body = (await res.json()) as any;
    expect(body).toEqual({
      accepted: true,
      referrer: { displayName: 'Chủ Mã Max Cap' },
      creditsEarned: 1,
      creditBalance: 4,
    });

    // Check referral record has status CAPPED
    const referralRecord = await testApp.connection
      .collection('referrals')
      .findOne({ refereeId: referee._id });
    expect(referralRecord?.status).toBe(ReferralStatus.CAPPED);

    // Referee got +1 credit
    const updatedReferee = await testApp.connection
      .collection('users')
      .findOne({ _id: referee._id });
    expect(updatedReferee?.creditBalance).toBe(4);

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
    expect(refereeTx?.amount).toBe(1);
    expect(refereeTx?.balanceAfter).toBe(4);
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


