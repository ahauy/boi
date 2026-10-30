import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { AuthProvider } from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

describe('OAuth Account Linking on Email Verification (TC-018)', () => {
  let testApp: TestAppInstance;
  const oauthEmail = 'oauth@example.com';
  const oauthToken = 'OAUTH_LINK_TOKEN_12345678901234567890123456';
  const oauthTokenHash = crypto.createHash('sha256').update(oauthToken).digest('hex');

  beforeAll(async () => {
    testApp = await createTestApp();

    // 1. Seed user created via Google OAuth (passwordHash is null)
    await testApp.connection.collection('users').insertOne({
      displayName: 'Google OAuth User',
      username: null,
      email: oauthEmail,
      passwordHash: null,
      passwordUpdatedAt: null,
      avatarUrl: 'https://lh3.googleusercontent.com/avatar.jpg',
      referralCode: 'GOOG0001',
      creditBalance: 3,
      identities: [
        {
          provider: AuthProvider.GOOGLE,
          providerUserId: 'google_uid_99999',
          email: oauthEmail,
          linkedAt: new Date(),
        },
      ],
      referralBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Seed pending_registrations attempting to attach password
    await testApp.connection.collection('pending_registrations').insertOne({
      displayName: 'Google OAuth User Updated',
      username: 'oauth_user',
      email: oauthEmail,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$newargonhash',
      referralCode: null,
      tokenHash: oauthTokenHash,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      createdAt: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('TC-018: should attach password to existing OAuth account without re-awarding signup bonus (isNewUser=false)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: oauthToken }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.isNewUser).toBe(false);
    expect(data.user.displayName).toBe('Google OAuth User');
    expect(data.user.username).toBe('oauth_user');
    expect(data.user.creditBalance).toBe(3);

    // Verify user in database
    const userDoc = await testApp.connection
      .collection('users')
      .findOne({ email: oauthEmail });

    expect(userDoc).toBeDefined();
    expect(userDoc!.username).toBe('oauth_user');
    expect(userDoc!.passwordHash).toBe('$argon2id$v=19$m=65536,t=3,p=4$newargonhash');
    expect(userDoc!.passwordUpdatedAt).toBeDefined();
    expect(userDoc!.creditBalance).toBe(3); // Unchanged

    // Verify no new SIGNUP_BONUS was written to credit_transactions
    const transactions = await testApp.connection
      .collection('credit_transactions')
      .find({ userId: userDoc!._id, type: 'SIGNUP_BONUS' })
      .toArray();

    expect(transactions.length).toBe(0);
  });
});
