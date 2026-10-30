import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

describe('POST /api/v1/auth/login (US-AUTH-002)', () => {
  let testApp: TestAppInstance;
  const rawPassword = 'CorrectPassword_123';
  let passwordHash: string;
  let validUserId: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    passwordHash = await argon2.hash(rawPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const usersCollection = testApp.connection.collection('users');
    const pendingCollection = testApp.connection.collection('pending_registrations');

    // 1. Seed active verified user
    const userInsert = await usersCollection.insertOne({
      displayName: 'Nguyễn Văn A',
      username: 'nguyenvana_login',
      email: 'nguyenvana_login@example.com',
      passwordHash,
      passwordUpdatedAt: new Date(),
      referralCode: 'AB3K7XYZ',
      creditBalance: 3,
      referralBlocked: false,
      identities: [],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    validUserId = userInsert.insertedId.toString();

    // 2. Seed soft-deleted user
    await usersCollection.insertOne({
      displayName: 'Deleted User',
      username: 'deleted_user',
      email: 'deleted@example.com',
      passwordHash,
      passwordUpdatedAt: new Date(),
      referralCode: 'DEL88XYZ',
      creditBalance: 0,
      referralBlocked: true,
      identities: [],
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Seed OAuth-only user (no passwordHash)
    await usersCollection.insertOne({
      displayName: 'Google User',
      username: 'google_user',
      email: 'google@example.com',
      passwordHash: null,
      referralCode: 'GOOG8XYZ',
      creditBalance: 3,
      referralBlocked: false,
      identities: [
        {
          provider: 'google',
          providerUserId: 'google-sub-123',
          email: 'google@example.com',
          linkedAt: new Date(),
        },
      ],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 4. Seed pending registration (unverified)
    await pendingCollection.insertOne({
      displayName: 'Pending Verification',
      username: 'pending_user',
      email: 'pending@example.com',
      passwordHash,
      referralCode: null,
      tokenHash: crypto.createHash('sha256').update('some-pending-token').digest('hex'),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      createdAt: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('TC-018A: should login successfully by email with correct password', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'nguyenvana_login@example.com',
        password: rawPassword,
      }),
    });

    expect(res.status).toBe(200);

    // Verify Set-Cookie header for refresh token
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('rt=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/api/v1/auth');
    expect(setCookie).toContain('SameSite=Lax');

    const data = (await res.json()) as any;
    expect(data.accessToken).toBeDefined();
    expect(data.expiresIn).toBe(900);
    expect(data.isNewUser).toBe(false);
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(validUserId);
    expect(data.user.displayName).toBe('Nguyễn Văn A');
    expect(data.user.username).toBe('nguyenvana_login');
    expect(data.user.creditBalance).toBe(3);
    expect(data.user.referralCode).toBe('AB3K7XYZ');

    // Verify session persisted in MongoDB
    const rtMatch = setCookie!.match(/rt=([^;]+)/);
    expect(rtMatch).not.toBeNull();
    const rawRt = rtMatch![1];
    const rtHash = crypto.createHash('sha256').update(rawRt).digest('hex');

    const sessionDoc = await testApp.connection
      .collection('sessions')
      .findOne({ refreshTokenHash: rtHash });
    expect(sessionDoc).toBeDefined();
    expect(sessionDoc!.userId.toString()).toBe(validUserId);
  });

  it('TC-018B: should login successfully by username (case-insensitive)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'NGUYENVANA_LOGIN',
        password: rawPassword,
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.user.username).toBe('nguyenvana_login');
    expect(data.isNewUser).toBe(false);
  });

  it('TC-018C: should revoke old session when rt cookie is present', async () => {
    const oldRawRt = 'old_session_rt_to_be_revoked_12345';
    const oldRtHash = crypto.createHash('sha256').update(oldRawRt).digest('hex');

    // Seed existing session with oldRtHash
    await testApp.connection.collection('sessions').insertOne({
      userId: validUserId,
      refreshTokenHash: oldRtHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      createdAt: new Date(),
    });

    // Login providing old rt in Cookie header
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `rt=${oldRawRt}`,
      },
      body: JSON.stringify({
        login: 'nguyenvana_login@example.com',
        password: rawPassword,
      }),
    });

    expect(res.status).toBe(200);

    // Old session should be revoked (deleted)
    const oldSession = await testApp.connection
      .collection('sessions')
      .findOne({ refreshTokenHash: oldRtHash });
    expect(oldSession).toBeNull();
  });

  it('TC-018D: should return 401 INVALID_CREDENTIALS for non-existent user', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'nobody_exists@example.com',
        password: rawPassword,
      }),
    });

    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Thông tin đăng nhập không chính xác.',
    });
  });

  it('TC-018E: should return 401 INVALID_CREDENTIALS for wrong password', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'nguyenvana_login@example.com',
        password: 'WrongPassword_999',
      }),
    });

    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Thông tin đăng nhập không chính xác.',
    });
  });

  it('TC-018F: should return 401 INVALID_CREDENTIALS for soft-deleted user', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'deleted@example.com',
        password: rawPassword,
      }),
    });

    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Thông tin đăng nhập không chính xác.',
    });
  });

  it('TC-018G: should return 401 INVALID_CREDENTIALS for user without passwordHash (OAuth only)', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'google@example.com',
        password: rawPassword,
      }),
    });

    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Thông tin đăng nhập không chính xác.',
    });
  });

  it('TC-018H: should return 403 EMAIL_NOT_VERIFIED with details.email for unverified pending registration', async () => {
    // 1. By email
    const resEmail = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'pending@example.com',
        password: rawPassword,
      }),
    });

    expect(resEmail.status).toBe(403);
    const dataEmail = (await resEmail.json()) as any;
    expect(dataEmail.error).toEqual({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Tài khoản chưa được xác minh email.',
      details: { email: 'pending@example.com' },
    });

    // 2. By username
    const resUsername = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: 'pending_user',
        password: rawPassword,
      }),
    });

    expect(resUsername.status).toBe(403);
    const dataUsername = (await resUsername.json()) as any;
    expect(dataUsername.error).toEqual({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Tài khoản chưa được xác minh email.',
      details: { email: 'pending@example.com' },
    });
  });

  it('TC-018I: should enforce rate limit: 429 RATE_LIMITED after 5 consecutive failed logins', async () => {
    const testLogin = 'ratelimit_target@example.com';
    const clientIp = '198.51.100.1';

    // 5 consecutive failed login attempts
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': clientIp,
        },
        body: JSON.stringify({
          login: testLogin,
          password: 'IncorrectPassword',
        }),
      });
      expect(res.status).toBe(401);
    }

    // 6th attempt should be blocked with 429 RATE_LIMITED
    const blockedRes = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': clientIp,
      },
      body: JSON.stringify({
        login: testLogin,
        password: 'IncorrectPassword',
      }),
    });

    expect(blockedRes.status).toBe(429);
    const blockedData = (await blockedRes.json()) as any;
    expect(blockedData.error).toEqual({
      code: 'RATE_LIMITED',
      message: 'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.',
    });

    // Different login target on same IP should not be blocked
    const otherLoginRes = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': clientIp,
      },
      body: JSON.stringify({
        login: 'other_target@example.com',
        password: 'IncorrectPassword',
      }),
    });
    expect(otherLoginRes.status).toBe(401);
  });

  it('TC-018J: should return 400 VALIDATION_ERROR for empty credentials', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: '',
        password: '',
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toBe('Dữ liệu gửi lên không hợp lệ.');
    expect(data.error.details.fields).toBeDefined();
    expect(data.error.details.fields.length).toBeGreaterThanOrEqual(1);
  });
});
