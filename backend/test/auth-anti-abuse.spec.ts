import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { DeletedIdentityKind } from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

describe('Anti-Abuse: Deleted Identity Check (TC-017)', () => {
  let testApp: TestAppInstance;
  const recycledEmail = 'recycled@example.com';
  const recycledToken = 'RECYCLED_TOKEN_12345678901234567890123456789';
  const recycledTokenHash = crypto.createHash('sha256').update(recycledToken).digest('hex');

  beforeAll(async () => {
    testApp = await createTestApp();

    const identitySecret = 'test-identity-secret-at-least-32-chars-long';
    const emailHmac = crypto
      .createHmac('sha256', identitySecret)
      .update(recycledEmail)
      .digest('hex');

    // Seed deleted_identities record
    await testApp.connection.collection('deleted_identities').insertOne({
      kind: DeletedIdentityKind.EMAIL,
      valueHmac: emailHmac,
      deletedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    });

    // Seed pending_registrations for recycled email
    await testApp.connection.collection('pending_registrations').insertOne({
      displayName: 'Recycled User',
      username: 'recycled_user',
      email: recycledEmail,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      referralCode: null,
      tokenHash: recycledTokenHash,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      createdAt: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('TC-017: should grant 0 credits, set referralBlocked=true, and NOT record SIGNUP_BONUS when email is in deleted_identities', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: recycledToken }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.creditBalance).toBe(0);

    // Verify user in database
    const userDoc = await testApp.connection
      .collection('users')
      .findOne({ email: recycledEmail });

    expect(userDoc).toBeDefined();
    expect(userDoc!.creditBalance).toBe(0);
    expect(userDoc!.referralBlocked).toBe(true);

    // Verify credit_transactions has NO SIGNUP_BONUS records for this user
    const tx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: userDoc!._id, type: 'SIGNUP_BONUS' });

    expect(tx).toBeNull();
  });
});
