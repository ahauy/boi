import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { AuthProvider } from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

const JWT_SECRET = 'test-jwt-secret-palm-sight-at-least-32-chars-long';
const OLD_PASSWORD = 'old-password-123';
const NEW_PASSWORD = 'brand-new-password-456';

describe('PUT /api/v1/me/password', () => {
  let testApp: TestAppInstance;
  let passwordHash: string;
  // Each auth request gets its own IP so the 10 req/min/IP limit on /auth/* never trips mid-suite
  let ipCounter = 0;

  const authPost = (path: string, init: { body?: unknown; rt?: string } = {}) =>
    fetch(`${testApp.baseUrl}/api/v1/auth/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.2.0.${++ipCounter}`,
        Origin: 'http://localhost:5173',
        ...(init.rt ? { Cookie: `rt=${init.rt}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  const changePassword = (accessToken: string | null, body: unknown) =>
    fetch(`${testApp.baseUrl}/api/v1/me/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });

  const seedUser = async (email: string, overrides: Record<string, unknown> = {}) => {
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

  const login = async (email: string, password = OLD_PASSWORD) => {
    const res = await authPost('login', { body: { login: email, password } });
    expect(res.status).toBe(200);
    const rt = res.headers.getSetCookie().find((c) => c.startsWith('rt='))!.match(/^rt=([^;]*)/)![1];
    return { accessToken: ((await res.json()) as any).accessToken as string, rt };
  };

  // Access token for a seeded user without going through a login endpoint
  const tokenFor = (userId: Types.ObjectId) =>
    new JwtService({ secret: JWT_SECRET }).sign({ sub: userId.toString(), sid: new Types.ObjectId().toString() });

  const errorCode = async (res: Response) => ((await res.json()) as any).error.code;

  beforeAll(async () => {
    testApp = await createTestApp();
    passwordHash = await argon2.hash(OLD_PASSWORD, { type: argon2.argon2id });
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('changes the password, keeps the current session and ends the other ones', async () => {
    const email = 'change.basic@example.com';
    const userId = await seedUser(email);
    const current = await login(email);
    const otherDevice = await login(email);

    const res = await changePassword(current.accessToken, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(204);

    expect((await authPost('refresh', { rt: current.rt })).status).toBe(200);
    expect((await authPost('refresh', { rt: otherDevice.rt })).status).toBe(401);

    expect((await authPost('login', { body: { login: email, password: OLD_PASSWORD } })).status).toBe(401);
    expect((await authPost('login', { body: { login: email, password: NEW_PASSWORD } })).status).toBe(200);

    const user = await testApp.connection.collection('users').findOne({ _id: userId });
    expect(user!.passwordUpdatedAt.getTime()).toBeGreaterThan(Date.now() - 10_000);
  });

  it('rejects a wrong current password with 400 CURRENT_PASSWORD_INCORRECT and keeps every session', async () => {
    const email = 'change.wrong@example.com';
    const userId = await seedUser(email);
    const current = await login(email);
    await login(email);

    const res = await changePassword(current.accessToken, {
      currentPassword: 'not-my-password',
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe('CURRENT_PASSWORD_INCORRECT');

    expect(await testApp.connection.collection('sessions').countDocuments({ userId })).toBe(2);
    expect((await authPost('login', { body: { login: email, password: OLD_PASSWORD } })).status).toBe(200);
  });

  it('answers 409 PASSWORD_NOT_SET for a Google-only user', async () => {
    const userId = await seedUser('change.google@example.com', {
      username: null,
      passwordHash: null,
      passwordUpdatedAt: null,
      identities: [
        {
          provider: AuthProvider.GOOGLE,
          providerUserId: 'google-sub-change',
          email: 'change.google@example.com',
          linkedAt: new Date(),
        },
      ],
    });

    const res = await changePassword(tokenFor(userId), { currentPassword: 'anything', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe('PASSWORD_NOT_SET');
  });

  it('rejects a new password that is too short, equals the current one, the email or the username', async () => {
    const email = 'change.rules@example.com';
    const userId = await seedUser(email, { username: 'change_rules_user' });
    const token = tokenFor(userId);

    for (const newPassword of ['short', OLD_PASSWORD, 'Change.Rules@Example.com', 'CHANGE_RULES_USER']) {
      const res = await changePassword(token, { currentPassword: OLD_PASSWORD, newPassword });
      expect(res.status).toBe(400);
      expect(await errorCode(res)).toBe('VALIDATION_ERROR');
    }

    const user = await testApp.connection.collection('users').findOne({ _id: userId });
    expect(user!.passwordHash).toBe(passwordHash);
  });

  it('requires an access token', async () => {
    const res = await changePassword(null, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('UNAUTHENTICATED');
  });

  it('allows 5 requests per hour per user, failed ones included, then answers 429 with Retry-After', async () => {
    const limitedId = await seedUser('change.limit@example.com');
    const otherId = await seedUser('change.limit.other@example.com');
    const wrongAttempt = { currentPassword: 'not-my-password', newPassword: NEW_PASSWORD };

    for (let i = 0; i < 5; i++) {
      expect((await changePassword(tokenFor(limitedId), wrongAttempt)).status).toBe(400);
    }

    const limited = await changePassword(tokenFor(limitedId), wrongAttempt);
    expect(limited.status).toBe(429);
    expect(await errorCode(limited)).toBe('RATE_LIMITED');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(3500);

    // The limit is per user, not global
    expect((await changePassword(tokenFor(otherId), wrongAttempt)).status).toBe(400);
  });
});
