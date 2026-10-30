import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { Types } from 'mongoose';
import { AuthProvider } from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

const OLD_PASSWORD = 'old-password-123';
const NEW_PASSWORD = 'brand-new-password-456';

describe('POST /auth/forgot-password + POST /auth/reset-password', () => {
  let testApp: TestAppInstance;
  let passwordHash: string;
  // Each request gets its own IP so the 10 req/min/IP limit on /auth/* never trips mid-suite
  let ipCounter = 0;

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${testApp.baseUrl}/api/v1/auth/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.1.0.${++ipCounter}`,
        Origin: 'http://localhost:5173',
        ...headers,
      },
      body: JSON.stringify(body),
    });

  const seedUser = async (
    email: string,
    overrides: Record<string, unknown> = {},
  ): Promise<Types.ObjectId> => {
    const { insertedId } = await testApp.connection.collection('users').insertOne({
      displayName: `User ${email}`,
      username: email.split('@')[0].replace(/[^a-z0-9_]/g, '_'),
      email,
      passwordHash,
      passwordUpdatedAt: new Date(),
      referralCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
      creditBalance: 3,
      referralBlocked: false,
      identities: [],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    return insertedId;
  };

  // Requests a reset link and returns the raw token from the captured email
  const requestReset = async (email: string): Promise<string> => {
    const before = testApp.sentResetEmails.length;
    const res = await post('forgot-password', { email });
    expect(res.status).toBe(202);
    expect(testApp.sentResetEmails.length).toBe(before + 1);
    const sent = testApp.sentResetEmails[testApp.sentResetEmails.length - 1];
    expect(sent.to).toBe(email);
    return sent.rawToken;
  };

  const login = (loginId: string, password: string) => post('login', { login: loginId, password });

  const errorCode = async (res: Response) => ((await res.json()) as any).error.code;

  beforeAll(async () => {
    testApp = await createTestApp();
    passwordHash = await argon2.hash(OLD_PASSWORD, { type: argon2.argon2id });
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  describe('forgot-password', () => {
    it('stores a hashed one-hour token and emails the link for an existing user', async () => {
      const userId = await seedUser('forgot.basic@example.com');
      const res = await post('forgot-password', { email: '  Forgot.Basic@Example.com ' });
      expect(res.status).toBe(202);
      expect(await res.text()).toBe('');

      const sent = testApp.sentResetEmails.at(-1)!;
      expect(sent.to).toBe('forgot.basic@example.com');

      const doc = await testApp.connection.collection('password_resets').findOne({ userId });
      expect(doc!.tokenHash).toBe(crypto.createHash('sha256').update(sent.rawToken).digest('hex'));
      expect(doc!.usedAt ?? null).toBeNull();
      const ttlMs = doc!.expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(59 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    it('answers 202 without sending anything for an unknown or deleted email', async () => {
      await seedUser('forgot.deleted@example.com', { deletedAt: new Date() });
      const before = testApp.sentResetEmails.length;

      for (const email of ['nobody@example.com', 'forgot.deleted@example.com']) {
        const res = await post('forgot-password', { email });
        expect(res.status).toBe(202);
        expect(await res.text()).toBe('');
      }
      expect(testApp.sentResetEmails.length).toBe(before);
    });

    it('cancels the previous unused link when a new one is requested', async () => {
      await seedUser('forgot.twice@example.com');
      const firstToken = await requestReset('forgot.twice@example.com');
      const secondToken = await requestReset('forgot.twice@example.com');

      const first = await post('reset-password', { token: firstToken, newPassword: NEW_PASSWORD });
      expect(first.status).toBe(400);
      expect(await errorCode(first)).toBe('RESET_TOKEN_INVALID');

      expect((await post('reset-password', { token: secondToken, newPassword: NEW_PASSWORD })).status).toBe(204);
    });

    it('rejects an invalid email with 400 VALIDATION_ERROR', async () => {
      const res = await post('forgot-password', { email: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(await errorCode(res)).toBe('VALIDATION_ERROR');
    });

    it('still answers 202 but stops emailing after 3 requests per address per hour', async () => {
      await seedUser('forgot.limit@example.com');
      const before = testApp.sentResetEmails.length;

      for (let i = 0; i < 4; i++) {
        expect((await post('forgot-password', { email: 'forgot.limit@example.com' })).status).toBe(202);
      }
      expect(testApp.sentResetEmails.length).toBe(before + 3);
    });
  });

  describe('reset-password', () => {
    it('sets the new password, ends every session and burns the link', async () => {
      const email = 'reset.basic@example.com';
      const userId = await seedUser(email);

      const loginRes = await login(email, OLD_PASSWORD);
      expect(loginRes.status).toBe(200);
      const rt = loginRes.headers.getSetCookie().find((c) => c.startsWith('rt='))!.match(/^rt=([^;]*)/)![1];

      const token = await requestReset(email);
      const res = await post('reset-password', { token, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(204);

      expect(await testApp.connection.collection('sessions').countDocuments({ userId })).toBe(0);
      expect((await post('refresh', {}, { Cookie: `rt=${rt}` })).status).toBe(401);

      expect((await login(email, OLD_PASSWORD)).status).toBe(401);
      expect((await login(email, NEW_PASSWORD)).status).toBe(200);

      const user = await testApp.connection.collection('users').findOne({ _id: userId });
      expect(user!.passwordUpdatedAt.getTime()).toBeGreaterThan(Date.now() - 10_000);

      const reuse = await post('reset-password', { token, newPassword: 'another-password-789' });
      expect(reuse.status).toBe(400);
      expect(await errorCode(reuse)).toBe('RESET_TOKEN_INVALID');
    });

    it('lets a Google-only user set a first password and then log in with email', async () => {
      const email = 'reset.google@example.com';
      await seedUser(email, {
        username: null,
        passwordHash: null,
        passwordUpdatedAt: null,
        identities: [
          { provider: AuthProvider.GOOGLE, providerUserId: 'google-sub-reset', email, linkedAt: new Date() },
        ],
      });
      expect((await login(email, NEW_PASSWORD)).status).toBe(401);

      const token = await requestReset(email);
      expect((await post('reset-password', { token, newPassword: NEW_PASSWORD })).status).toBe(204);
      expect((await login(email, NEW_PASSWORD)).status).toBe(200);
    });

    it('rejects a password equal to the email or username without consuming the link', async () => {
      const email = 'reset.same@example.com';
      await seedUser(email, { username: 'reset_same_user' });
      const token = await requestReset(email);

      for (const newPassword of ['Reset.Same@Example.com', 'RESET_SAME_USER']) {
        const res = await post('reset-password', { token, newPassword });
        expect(res.status).toBe(400);
        const body = (await res.json()) as any;
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details.fields[0].field).toBe('newPassword');
      }

      expect((await post('reset-password', { token, newPassword: NEW_PASSWORD })).status).toBe(204);
    });

    it('rejects a too-short password with 400 VALIDATION_ERROR', async () => {
      await seedUser('reset.short@example.com');
      const token = await requestReset('reset.short@example.com');
      const res = await post('reset-password', { token, newPassword: 'short' });
      expect(res.status).toBe(400);
      expect(await errorCode(res)).toBe('VALIDATION_ERROR');
    });

    it('rejects an unknown or expired token with 400 RESET_TOKEN_INVALID', async () => {
      const unknown = await post('reset-password', { token: 'not-a-real-token', newPassword: NEW_PASSWORD });
      expect(unknown.status).toBe(400);
      expect(await errorCode(unknown)).toBe('RESET_TOKEN_INVALID');

      const userId = await seedUser('reset.expired@example.com');
      const expiredToken = 'expired-reset-token-for-test';
      await testApp.connection.collection('password_resets').insertOne({
        userId,
        tokenHash: crypto.createHash('sha256').update(expiredToken).digest('hex'),
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        createdAt: new Date(),
      });
      const expired = await post('reset-password', { token: expiredToken, newPassword: NEW_PASSWORD });
      expect(expired.status).toBe(400);
      expect(await errorCode(expired)).toBe('RESET_TOKEN_INVALID');
    });

    it('accepts only one of two concurrent submissions of the same link', async () => {
      await seedUser('reset.race@example.com');
      const token = await requestReset('reset.race@example.com');

      const results = await Promise.all([
        post('reset-password', { token, newPassword: 'race-password-one' }),
        post('reset-password', { token, newPassword: 'race-password-two' }),
      ]);
      expect(results.map((res) => res.status).sort()).toEqual([204, 400]);
    });
  });
});
