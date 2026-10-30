import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { ReferralStatus, CreditTransactionType } from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

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

  it('TC-019: should award 4 credits to referee (3 signup + 1 referee) and 2 credits to referrer atomically', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: refereeToken }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.isNewUser).toBe(true);
    expect(data.user.creditBalance).toBe(4);

    // Verify Referee user document
    const refereeDoc = await testApp.connection
      .collection('users')
      .findOne({ email: refereeEmail });

    expect(refereeDoc).toBeDefined();
    expect(refereeDoc!.creditBalance).toBe(4);

    // Verify Referrer user document (5 + 2 = 7)
    const referrerDoc = await testApp.connection
      .collection('users')
      .findOne({ _id: referrerId });

    expect(referrerDoc).toBeDefined();
    expect(referrerDoc!.creditBalance).toBe(7);

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
    expect(refereeBonusTx!.amount).toBe(1);
    expect(refereeBonusTx!.balanceAfter).toBe(4);

    // Verify Referrer credit ledger transaction
    const referrerBonusTx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: referrerId, type: CreditTransactionType.REFERRAL_BONUS });
    expect(referrerBonusTx).toBeDefined();
    expect(referrerBonusTx!.amount).toBe(2);
    expect(referrerBonusTx!.balanceAfter).toBe(7);

    // Verify Referral document
    const referralDoc = await testApp.connection.collection('referrals').findOne({
      referrerId,
      refereeId: refereeDoc!._id,
    });
    expect(referralDoc).toBeDefined();
    expect(referralDoc!.codeUsed).toBe(referrerCode);
    expect(referralDoc!.status).toBe(ReferralStatus.REWARDED);
  });
});
