import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

describe('POST /api/v1/auth/register (TC-010, TC-011, TC-021)', () => {
  let testApp: TestAppInstance;

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it(
    'TC-010: should successfully register new account without referral code (Happy Path)',
    async () => {
      const payload = {
        displayName: 'Nguyễn Văn A',
        username: 'nguyenvana',
        email: 'nguyenvana@example.com',
        password: 'matkhau_123456',
      };

      const res = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(202);
      const data = (await res.json()) as any;
      expect(data.email).toBe('nguyenvana@example.com');
      expect(data.verificationExpiresAt).toBeDefined();

      const expiresAtDate = new Date(data.verificationExpiresAt);
      expect(expiresAtDate.getTime()).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);

      // Verify pending_registrations collection in MongoDB using active connection
      const pendingCollection = testApp.connection.collection('pending_registrations');
      const pendingDoc = await pendingCollection.findOne({ email: 'nguyenvana@example.com' });

      expect(pendingDoc).toBeDefined();
      expect(pendingDoc!.email).toBe('nguyenvana@example.com');
      expect(pendingDoc!.username).toBe('nguyenvana');
      expect(pendingDoc!.passwordHash).toMatch(/^\$argon2id\$/);
      expect(pendingDoc!.referralCode).toBeNull();
      expect(pendingDoc!.tokenHash).toHaveLength(64);

      // Verify users collection has NO records
      const usersCollection = testApp.connection.collection('users');
      const userDoc = await usersCollection.findOne({ email: 'nguyenvana@example.com' });
      expect(userDoc).toBeNull();

      // Verify email was dispatched
      expect(testApp.sentEmails.length).toBeGreaterThan(0);
      const sent = testApp.sentEmails.find((e) => e.to === 'nguyenvana@example.com');
      expect(sent).toBeDefined();
      expect(sent!.displayName).toBe('Nguyễn Văn A');

      // Verify tokenHash matches rawToken in email
      const calculatedHash = crypto.createHash('sha256').update(sent!.rawToken).digest('hex');
      expect(calculatedHash).toBe(pendingDoc!.tokenHash);
    },
    20000,
  );

  it('TC-011: should reject registration with invalid payload (400 VALIDATION_ERROR)', async () => {
    const invalidPayload = {
      displayName: 'Nguyễn Văn A',
      username: 'ab', // too short
      email: 'invalid-email',
      // missing password
    };

    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.details?.fields?.length).toBeGreaterThan(0);

    const fieldNames = data.error.details.fields.map((f: { field: string }) => f.field);
    expect(fieldNames).toContain('username');
    expect(fieldNames).toContain('email');
    expect(fieldNames).toContain('password');
  });

  it('TC-021: should enforce rate limiting (3 emails/hr per address)', async () => {
    const victimEmail = 'spam_victim@example.com';
    const payload = {
      displayName: 'Victim',
      email: victimEmail,
      password: 'password_12345',
    };

    // First 3 registration requests
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, username: `vic_${i}_${Date.now() % 10000}` }),
      });
      expect(res.status).toBe(202);
    }

    // 4th request exceeds 3/hour limit
    const fourthRes = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, username: `vic_ex_${Date.now() % 10000}` }),
    });

    expect(fourthRes.status).toBe(429);
    expect(fourthRes.headers.get('retry-after')).toBe('3600');
    const data = (await fourthRes.json()) as any;
    expect(data.error.code).toBe('RATE_LIMITED');
  });
});
