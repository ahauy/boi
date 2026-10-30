import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

describe('POST /api/v1/auth/verify-email (TC-015, TC-016, TC-020)', () => {
  let testApp: TestAppInstance;
  const validToken = 'VALID_TOKEN_ABC_123_456_789_012_345_678_901';
  const validTokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

  const expiredToken = 'EXPIRED_TOKEN_ABC_123_456_789_012_345_678_9';
  const expiredTokenHash = crypto.createHash('sha256').update(expiredToken).digest('hex');

  const raceToken = 'RACE_TOKEN_ABC_123_456_789_012_345_678_9012';
  const raceTokenHash = crypto.createHash('sha256').update(raceToken).digest('hex');

  beforeAll(async () => {
    testApp = await createTestApp();

    const pendingCollection = testApp.connection.collection('pending_registrations');
    // Seed valid token
    await pendingCollection.insertOne({
      displayName: 'Nguyễn Văn A',
      username: 'nguyenvana_verify',
      email: 'nguyenvana_verify@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      referralCode: null,
      tokenHash: validTokenHash,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      createdAt: new Date(),
    });

    // Seed expired token
    await pendingCollection.insertOne({
      displayName: 'Expired User',
      username: 'expired_user',
      email: 'expired@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      tokenHash: expiredTokenHash,
      expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      createdAt: new Date(),
    });

    // Seed race token
    await pendingCollection.insertOne({
      displayName: 'Race User',
      username: 'race_user',
      email: 'race@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      tokenHash: raceTokenHash,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      createdAt: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('TC-015: should atomically activate account without referral code and grant +3 credits SIGNUP_BONUS', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: validToken }),
    });

    expect(res.status).toBe(200);

    // Verify Set-Cookie header contains rt with security directives
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('rt=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/api/v1/auth');
    expect(setCookie).toContain('SameSite=Lax');

    const data = (await res.json()) as any;
    expect(data.accessToken).toBeDefined();
    expect(data.expiresIn).toBe(900);
    expect(data.isNewUser).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.displayName).toBe('Nguyễn Văn A');
    expect(data.user.username).toBe('nguyenvana_verify');
    expect(data.user.creditBalance).toBe(3);
    expect(data.user.referralCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);

    // Verify MongoDB state inside transaction
    const usersCollection = testApp.connection.collection('users');
    const userDoc = await usersCollection.findOne({ email: 'nguyenvana_verify@example.com' });
    expect(userDoc).toBeDefined();
    expect(userDoc!.creditBalance).toBe(3);
    expect(userDoc!.referralBlocked).toBe(false);

    const creditCollection = testApp.connection.collection('credit_transactions');
    const creditTx = await creditCollection.findOne({ userId: userDoc!._id });
    expect(creditTx).toBeDefined();
    expect(creditTx!.amount).toBe(3);
    expect(creditTx!.type).toBe('SIGNUP_BONUS');
    expect(creditTx!.balanceAfter).toBe(3);

    const sessionsCollection = testApp.connection.collection('sessions');
    const sessionDoc = await sessionsCollection.findOne({ userId: userDoc!._id });
    expect(sessionDoc).toBeDefined();
    expect(sessionDoc!.refreshTokenHash).toHaveLength(64);

    const pendingCollection = testApp.connection.collection('pending_registrations');
    const pendingDoc = await pendingCollection.findOne({ tokenHash: validTokenHash });
    expect(pendingDoc).toBeNull();
  });

  it('TC-016: should reject activation when token is expired or invalid (400 VERIFICATION_TOKEN_INVALID)', async () => {
    // 1. Expired token
    const resExpired = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expiredToken }),
    });

    expect(resExpired.status).toBe(400);
    const dataExpired = (await resExpired.json()) as any;
    expect(dataExpired.error.code).toBe('VERIFICATION_TOKEN_INVALID');
    expect(dataExpired.error.message).toBe('Liên kết xác minh không hợp lệ hoặc đã hết hạn.');

    // 2. Non-existent random token
    const resRandom = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'completely_random_unknown_token_1234567890' }),
    });

    expect(resRandom.status).toBe(400);
    const dataRandom = (await resRandom.json()) as any;
    expect(dataRandom.error.code).toBe('VERIFICATION_TOKEN_INVALID');
  });

  it('TC-020: should prevent race conditions when two concurrent requests submit the same verification token', async () => {
    const [res1, res2] = await Promise.all([
      fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: raceToken }),
      }),
      fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: raceToken }),
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Exactly one must succeed (200), and one must fail (400)
    expect(statuses).toEqual([200, 400]);

    const successRes = res1.status === 200 ? res1 : res2;
    const failRes = res1.status === 400 ? res1 : res2;

    const successData = (await successRes.json()) as any;
    expect(successData.user.creditBalance).toBe(3);

    const failData = (await failRes.json()) as any;
    expect(failData.error.code).toBe('VERIFICATION_TOKEN_INVALID');

    // Verify user was created exactly once
    const userDocs = await testApp.connection
      .collection('users')
      .find({ email: 'race@example.com' })
      .toArray();
    expect(userDocs.length).toBe(1);
    expect(userDocs[0].creditBalance).toBe(3);
  });
});
