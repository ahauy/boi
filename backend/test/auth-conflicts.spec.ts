import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

describe('Auth Conflicts: EMAIL_TAKEN and USERNAME_TAKEN (TC-012, TC-013)', () => {
  let testApp: TestAppInstance;

  beforeAll(async () => {
    testApp = await createTestApp();

    // 1. Seed existing user with passwordHash
    const usersCollection = testApp.connection.collection('users');
    await usersCollection.insertOne({
      displayName: 'Existing User',
      username: 'existing_user',
      email: 'existing@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      referralCode: 'EXIST001',
      creditBalance: 3,
      referralBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Seed existing OAuth user without passwordHash
    await usersCollection.insertOne({
      displayName: 'OAuth User',
      username: 'oauth_user',
      email: 'oauth@example.com',
      passwordHash: null,
      identities: [
        {
          provider: 'google',
          providerUserId: 'google-oauth-sub-12345',
          email: 'oauth@example.com',
          linkedAt: new Date(),
        },
      ],
      referralCode: 'OAUTH001',
      creditBalance: 3,
      referralBlocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Seed pending_registrations for username conflict
    const pendingCollection = testApp.connection.collection('pending_registrations');
    await pendingCollection.insertOne({
      displayName: 'Pending Holder',
      username: 'palmsight_pro',
      email: 'user1@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      createdAt: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('TC-012: should return 409 Conflict with EMAIL_TAKEN when registering with existing password user', async () => {
    const payload = {
      displayName: 'Duplicate Email Attempt',
      username: 'new_unique_name',
      email: 'existing@example.com',
      password: 'new_password_123',
    };

    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('EMAIL_TAKEN');
    expect(data.error.message).toBe('Email này đã được sử dụng.');

    // Ensure no pending registration was created for this username
    const pending = await testApp.connection
      .collection('pending_registrations')
      .findOne({ username: 'new_unique_name' });
    expect(pending).toBeNull();
  });

  it('TC-012b: should return 409 Conflict with EMAIL_TAKEN when registering with existing OAuth user without passwordHash', async () => {
    const payload = {
      displayName: 'OAuth Duplicate Email Attempt',
      username: 'unique_oauth_user',
      email: 'oauth@example.com',
      password: 'new_password_123',
    };

    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('EMAIL_TAKEN');
    expect(data.error.message).toBe(
      'Email này đã được liên kết với tài khoản Google hoặc Facebook. Vui lòng đăng nhập.',
    );

    // Ensure no pending registration was created for this username
    const pending = await testApp.connection
      .collection('pending_registrations')
      .findOne({ username: 'unique_oauth_user' });
    expect(pending).toBeNull();
  });

  it('TC-013: should return 409 Conflict with USERNAME_TAKEN when username is reserved in pending_registrations', async () => {
    const payload = {
      displayName: 'Username Stealer Attempt',
      username: 'palmsight_pro',
      email: 'user2@example.com',
      password: 'new_password_123',
    };

    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('USERNAME_TAKEN');
    expect(data.error.message).toBe('Tên người dùng đã được sử dụng.');
  });
});
