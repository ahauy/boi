import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { Types } from 'mongoose';
import {
  CreditTransactionType,
  HandOrientation,
  ReadingSchool,
  ReadingStatus,
  ReferralStatus,
} from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { hashIp } from '../src/common/client-ip.util';
import { startOfReferralDay } from '../src/referrals/referral-day.util';

let seq = 0;

const seedReferrer = async (
  testApp: TestAppInstance,
  referralCode: string,
  overrides: Record<string, unknown> = {},
) => {
  const n = ++seq;
  const { insertedId } = await testApp.connection.collection('users').insertOne({
    displayName: `Referrer ${n}`,
    username: `referrer_${n}`,
    email: `referrer.${n}@example.com`,
    referralCode,
    creditBalance: 0,
    referralBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return insertedId;
};

const seedRewardedToday = (
  testApp: TestAppInstance,
  referrerId: unknown,
  referralCode: string,
  count: number,
) =>
  testApp.connection.collection('referrals').insertMany(
    Array.from({ length: count }).map(() => ({
      referrerId,
      refereeId: new Types.ObjectId(),
      codeUsed: referralCode,
      status: ReferralStatus.REWARDED,
      createdAt: new Date(startOfReferralDay().getTime() + 60 * 1000),
    })),
  );

const seedPending = async (
  testApp: TestAppInstance,
  referralCode: string,
  overrides: Record<string, unknown> = {},
) => {
  const n = ++seq;
  const token = `REFERRAL_VERIFY_TOKEN_${n}_1234567890123456789012`;
  const email = `invitee.${n}@example.com`;
  await testApp.connection.collection('pending_registrations').insertOne({
    displayName: `Invitee ${n}`,
    username: `invitee_${n}`,
    email,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
    referralCode,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    createdAt: new Date(),
    ...overrides,
  });
  return { token, email };
};

const verifyEmail = (testApp: TestAppInstance, token: string, ip?: string) =>
  fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ip ? { 'cf-connecting-ip': ip } : {}),
    },
    body: JSON.stringify({ token }),
  });

describe('Referral Bonus on Email Verification (TC-019)', () => {
  let testApp: TestAppInstance;
  const referrerCode = 'REF88888';
  const refereeEmail = 'newbee@example.com';
  const refereeToken = 'REFERRAL_NEWBEE_TOKEN_12345678901234567890';
  const refereeTokenHash = crypto.createHash('sha256').update(refereeToken).digest('hex');

  let referrerId: any;

  beforeAll(async () => {
    testApp = await createTestApp();

    // 1. Seed referrer user with referralCode "REF88888" and 5 credits
    const referrerInsert = await testApp.connection.collection('users').insertOne({
      displayName: 'Referrer Pro',
      username: 'referrer_pro',
      email: 'referrer@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      referralCode: referrerCode,
      creditBalance: 5,
      referralBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    referrerId = referrerInsert.insertedId;

    // 2. Seed pending_registrations with referralCode "REF88888"
    await testApp.connection.collection('pending_registrations').insertOne({
      displayName: 'Newbee Referee',
      username: 'newbee_referee',
      email: refereeEmail,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      referralCode: referrerCode,
      tokenHash: refereeTokenHash,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      createdAt: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('TC-019: should award 8 GEM to referee (3 signup + 5 referee) and 3 GEM to referrer atomically', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: refereeToken }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.isNewUser).toBe(true);
    expect(data.user.creditBalance).toBe(8);
    expect(data.referralApplied).toBe(true);

    // Verify Referee user document
    const refereeDoc = await testApp.connection
      .collection('users')
      .findOne({ email: refereeEmail });

    expect(refereeDoc).toBeDefined();
    expect(refereeDoc!.creditBalance).toBe(8);

    // Verify Referrer user document (5 + 3 = 8)
    const referrerDoc = await testApp.connection
      .collection('users')
      .findOne({ _id: referrerId });

    expect(referrerDoc).toBeDefined();
    expect(referrerDoc!.creditBalance).toBe(8);

    // Verify Referee credit ledger transactions
    const refereeSignupTx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: refereeDoc!._id, type: CreditTransactionType.SIGNUP_BONUS });
    expect(refereeSignupTx).toBeDefined();
    expect(refereeSignupTx!.amount).toBe(3);
    expect(refereeSignupTx!.balanceAfter).toBe(3);

    const refereeBonusTx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: refereeDoc!._id, type: CreditTransactionType.REFEREE_BONUS });
    expect(refereeBonusTx).toBeDefined();
    expect(refereeBonusTx!.amount).toBe(5);
    expect(refereeBonusTx!.balanceAfter).toBe(8);

    // Verify Referrer credit ledger transaction
    const referrerBonusTx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: referrerId, type: CreditTransactionType.REFERRAL_BONUS });
    expect(referrerBonusTx).toBeDefined();
    expect(referrerBonusTx!.amount).toBe(3);
    expect(referrerBonusTx!.balanceAfter).toBe(8);

    // Verify Referral document
    const referralDoc = await testApp.connection.collection('referrals').findOne({
      referrerId,
      refereeId: refereeDoc!._id,
    });
    expect(referralDoc).toBeDefined();
    expect(referralDoc!.codeUsed).toBe(referrerCode);
    expect(referralDoc!.status).toBe(ReferralStatus.REWARDED);
    expect(referralDoc!.referrerReward).toBe(3);
    expect(refereeBonusTx!.referralId.toString()).toBe(referralDoc!._id.toString());
  });

  it('CAPPED: referee still gets +5, referrer gets nothing, the referee bonus keeps referralId', async () => {
    const code = 'CAPD8888';
    const referrer = await seedReferrer(testApp, code, { creditBalance: 7 });
    await seedRewardedToday(testApp, referrer, code, 5);
    const { token, email } = await seedPending(testApp, code);

    const res = await verifyEmail(testApp, token);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.creditBalance).toBe(8);
    expect(data.referralApplied).toBe(true);

    const users = testApp.connection.collection('users');
    const referee = await users.findOne({ email });
    expect((await users.findOne({ _id: referrer }))?.creditBalance).toBe(7);

    const referral = await testApp.connection
      .collection('referrals')
      .findOne({ refereeId: referee!._id });
    expect(referral?.status).toBe(ReferralStatus.CAPPED);
    expect(referral?.referrerReward).toBe(0);

    const transactions = testApp.connection.collection('credit_transactions');
    const bonus = await transactions.findOne({
      userId: referee!._id,
      type: CreditTransactionType.REFEREE_BONUS,
    });
    expect(bonus?.amount).toBe(5);
    expect(bonus?.referralId.toString()).toBe(referral?._id.toString());
    expect(
      await transactions.countDocuments({
        userId: referrer,
        type: CreditTransactionType.REFERRAL_BONUS,
      }),
    ).toBe(0);
  });

  it('a code owned by a deleted account is ignored and the account is still created', async () => {
    const code = 'DELT8888';
    await seedReferrer(testApp, code, { deletedAt: new Date(), creditBalance: 1 });
    const { token, email } = await seedPending(testApp, code);

    const res = await verifyEmail(testApp, token);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.creditBalance).toBe(3);
    expect(data.referralApplied).not.toBe(true);

    const referee = await testApp.connection.collection('users').findOne({ email });
    expect(referee?.creditBalance).toBe(3);
    expect(
      await testApp.connection.collection('referrals').findOne({ refereeId: referee!._id }),
    ).toBeNull();
  });

  it('concurrent verifications with one slot left: all succeed and exactly one is rewarded', async () => {
    const code = 'RACE8888';
    const referrer = await seedReferrer(testApp, code);
    await seedRewardedToday(testApp, referrer, code, 4);
    const pendings = await Promise.all(
      Array.from({ length: 6 }).map(() => seedPending(testApp, code)),
    );

    const results = await Promise.all(pendings.map((p) => verifyEmail(testApp, p.token)));
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(200));

    const bodies = (await Promise.all(results.map((r) => r.json()))) as any[];
    expect(bodies.map((b) => b.user.creditBalance)).toEqual(Array(6).fill(8));
    expect(bodies.every((b) => b.referralApplied === true)).toBe(true);

    const referrals = await testApp.connection
      .collection('referrals')
      .find({ referrerId: referrer, codeUsed: code, status: { $exists: true } })
      .toArray();
    expect(referrals.filter((r) => r.status === ReferralStatus.REWARDED)).toHaveLength(5);
    expect(referrals.filter((r) => r.status === ReferralStatus.CAPPED)).toHaveLength(5);

    const referrerDoc = await testApp.connection.collection('users').findOne({ _id: referrer });
    expect(referrerDoc?.creditBalance).toBe(3);
  });
});

describe('Referral network limit on email verification', () => {
  let testApp: TestAppInstance;

  const register = (ip: string, referralCode: string) => {
    const n = ++seq;
    return fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': ip,
        'x-forwarded-for': `198.51.100.${n}`,
      },
      body: JSON.stringify({
        displayName: `Network ${n}`,
        username: `network_${n}`,
        email: `network.${n}@example.com`,
        password: 'Secret_123',
        referralCode,
      }),
    });
  };

  const expectSkipped = async (res: Response, email: string) => {
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.creditBalance).toBe(3);
    expect(data.referralApplied).not.toBe(true);

    const user = await testApp.connection.collection('users').findOne({ email });
    expect(user).not.toBeNull();
    expect(
      await testApp.connection.collection('referrals').findOne({ refereeId: user!._id }),
    ).toBeNull();
  };

  beforeAll(async () => {
    testApp = await createTestApp({ referralNetworkDailyCap: 2 });
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('counts the registration network, not the network that opens the link, and skips only the reward', async () => {
    const code = 'NETV8888';
    const referrer = await seedReferrer(testApp, code);
    for (let i = 0; i < 3; i++) {
      expect((await register('203.0.113.40', code)).status).toBe(202);
    }

    const tokens = testApp.sentEmails.map((m) => ({ token: m.rawToken, email: m.to }));
    const verifiedFrom = ['203.0.113.41', '203.0.113.42', '203.0.113.43'];

    for (const i of [0, 1]) {
      const res = await verifyEmail(testApp, tokens[i].token, verifiedFrom[i]);
      expect(res.status).toBe(200);
      expect(((await res.json()) as any).referralApplied).toBe(true);
    }

    await expectSkipped(await verifyEmail(testApp, tokens[2].token, verifiedFrom[2]), tokens[2].email);

    const referrerDoc = await testApp.connection.collection('users').findOne({ _id: referrer });
    expect(referrerDoc?.creditBalance).toBe(6);
  });

  it('falls back to the verifying network for a pending record without a stored IP', async () => {
    const ip = '203.0.113.50';
    const code = 'NETF8888';
    await seedReferrer(testApp, code);
    const pendings = [
      await seedPending(testApp, code),
      await seedPending(testApp, code),
      await seedPending(testApp, code),
    ];

    expect(((await (await verifyEmail(testApp, pendings[0].token, ip)).json()) as any).referralApplied).toBe(true);
    expect(((await (await verifyEmail(testApp, pendings[1].token, ip)).json()) as any).referralApplied).toBe(true);
    await expectSkipped(await verifyEmail(testApp, pendings[2].token, ip), pendings[2].email);
  });

  it('concurrent verifications from one network never pass the cap and all accounts are created', async () => {
    const signupIpHash = hashIp('203.0.113.60');
    const code = 'NETC8888';
    await seedReferrer(testApp, code);
    const pendings = await Promise.all(
      Array.from({ length: 4 }).map(() => seedPending(testApp, code, { signupIpHash })),
    );

    const results = await Promise.all(pendings.map((p) => verifyEmail(testApp, p.token)));
    expect(results.map((r) => r.status)).toEqual(Array(4).fill(200));

    const bodies = (await Promise.all(results.map((r) => r.json()))) as any[];
    expect(bodies.filter((b) => b.referralApplied === true)).toHaveLength(2);
  });

  it('no usable IP: the reward is applied without network accounting', async () => {
    const code = 'NETN8888';
    await seedReferrer(testApp, code);
    const { token } = await seedPending(testApp, code);

    const res = await verifyEmail(testApp, token);
    expect(((await res.json()) as any).referralApplied).toBe(true);
  });
});

describe('Balance after signup with the production economy (grant 5, price 5)', () => {
  let testApp: TestAppInstance;

  const seedGuestPreview = async () => {
    const claimToken = crypto.randomUUID();
    await testApp.connection.collection('readings').insertOne({
      userId: null,
      isGuest: true,
      idempotencyKey: crypto.randomUUID(),
      guestTokenHash: crypto.createHash('sha256').update(claimToken).digest('hex'),
      school: ReadingSchool.WESTERN,
      hand: HandOrientation.LEFT,
      topics: ['lifeLine'],
      status: ReadingStatus.GUEST_PREVIEW,
      previewExpiresAt: new Date(Date.now() + 3600 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return claimToken;
  };

  const expectBalance = async (res: Response, email: string, expected: number) => {
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    const stored = await testApp.connection.collection('users').findOne({ email });
    expect(data.user.creditBalance).toBe(expected);
    expect(stored!.creditBalance).toBe(expected);
    return data;
  };

  beforeAll(async () => {
    testApp = await createTestApp({ starterGrant: 5, pricePerAction: 5 });
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('signup with a referral code ends at 10 GEM', async () => {
    await seedReferrer(testApp, 'ECNREF22');
    const { token, email } = await seedPending(testApp, 'ECNREF22');

    const data = await expectBalance(await verifyEmail(testApp, token), email, 10);
    expect(data.referralApplied).toBe(true);
  });

  it('trial claim without a referral code spends the real price and reports 0 GEM', async () => {
    const claimToken = await seedGuestPreview();
    const { token, email } = await seedPending(testApp, undefined as unknown as string, {
      claimToken,
    });

    const data = await expectBalance(await verifyEmail(testApp, token), email, 0);
    expect(data.claimedReadingId).toBeTruthy();
  });

  it('trial claim with a referral code reports 5 GEM, matching the stored balance', async () => {
    await seedReferrer(testApp, 'ECNREF33');
    const claimToken = await seedGuestPreview();
    const { token, email } = await seedPending(testApp, 'ECNREF33', { claimToken });

    const data = await expectBalance(await verifyEmail(testApp, token), email, 5);
    expect(data.claimedReadingId).toBeTruthy();
    expect(data.referralApplied).toBe(true);

    const user = await testApp.connection.collection('users').findOne({ email });
    const spend = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: user!._id, type: CreditTransactionType.READING_SPEND });
    expect(spend!.amount).toBe(-5);
    expect(spend!.balanceAfter).toBe(5);
  });
});
