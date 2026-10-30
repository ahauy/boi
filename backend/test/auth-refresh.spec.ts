import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import type { GoogleProfile } from '../src/auth/google-auth.verifier';

const JWT_SECRET = 'test-jwt-secret-palm-sight-at-least-32-chars-long';
const ORIGIN = 'http://localhost:5173';

const googleProfile: GoogleProfile = {
  sub: 'google-sub-refresh',
  email: 'refresh.user@example.com',
  emailVerified: true,
  name: 'Refresh User',
  picture: null,
};

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

const rtCookie = (res: Response) =>
  res.headers.getSetCookie().find((cookie) => cookie.startsWith('rt='));

const rtValue = (res: Response) => rtCookie(res)!.match(/^rt=([^;]*)/)![1];

const expectCookieCleared = (res: Response) => {
  const cookie = rtCookie(res);
  expect(cookie).toMatch(/^rt=;/);
  expect(cookie).toContain('Max-Age=0');
  expect(cookie).toContain('Path=/api/v1/auth');
};

describe('POST /auth/refresh + POST /auth/logout', () => {
  let testApp: TestAppInstance;
  let userId: string;
  // Each request gets its own IP so the 10 req/min/IP limit on /auth/* never trips mid-suite
  let ipCounter = 0;

  const post = (path: string, opts: { rt?: string; origin?: string | null } = {}) => {
    const headers: Record<string, string> = { 'X-Forwarded-For': `10.0.0.${++ipCounter}` };
    if (opts.origin !== null) headers.Origin = opts.origin ?? ORIGIN;
    if (opts.rt !== undefined) headers.Cookie = `rt=${opts.rt}`;
    return fetch(`${testApp.baseUrl}/api/v1/auth/${path}`, { method: 'POST', headers });
  };

  const login = async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.0.${++ipCounter}` },
      body: JSON.stringify({ idToken: 'any' }),
    });
    expect(res.status).toBe(200);
    userId = ((await res.json()) as any).user.id;
    return rtValue(res);
  };

  const findSession = (rt: string) =>
    testApp.connection.collection('sessions').findOne({ refreshTokenHash: hashToken(rt) });

  beforeAll(async () => {
    testApp = await createTestApp({ googleVerifier: { verify: async () => googleProfile } });
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues an access token for the new session', async () => {
      const oldRt = await login();

      const res = await post('refresh', { rt: oldRt });
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(Object.keys(body).sort()).toEqual(['accessToken', 'expiresIn']);
      expect(body.expiresIn).toBe(900);

      const newRt = rtValue(res);
      expect(newRt).not.toBe(oldRt);
      expect(rtCookie(res)).toContain('Max-Age=2592000');
      expect(rtCookie(res)).toContain('HttpOnly');

      const newSession = await findSession(newRt);
      const payload = new JwtService({ secret: JWT_SECRET }).verify(body.accessToken);
      expect(payload.sub).toBe(userId);
      expect(payload.sid).toBe(newSession!._id.toString());
      expect(newSession!.revokedAt ?? null).toBeNull();

      const oldSession = await findSession(oldRt);
      expect(oldSession!.revokedAt).toBeInstanceOf(Date);

      const me = await fetch(`${testApp.baseUrl}/api/v1/me`, {
        headers: { Authorization: `Bearer ${body.accessToken}` },
      });
      expect(me.status).toBe(200);
    });

    it('revokes every session of the user when a rotated token is reused', async () => {
      const oldRt = await login();
      const otherDeviceRt = await login();
      const newRt = rtValue(await post('refresh', { rt: oldRt }));

      const reuse = await post('refresh', { rt: oldRt });
      expect(reuse.status).toBe(401);
      expect(((await reuse.json()) as any).error.code).toBe('UNAUTHENTICATED');
      expectCookieCleared(reuse);

      expect(await testApp.connection.collection('sessions').countDocuments({ userId: new Types.ObjectId(userId) })).toBe(0);
      expect((await post('refresh', { rt: newRt })).status).toBe(401);
      expect((await post('refresh', { rt: otherDeviceRt })).status).toBe(401);
    });

    it('lets only one of two concurrent refreshes with the same token succeed', async () => {
      const rt = await login();
      const results = await Promise.all([post('refresh', { rt }), post('refresh', { rt })]);
      expect(results.map((res) => res.status).sort()).toEqual([200, 401]);
    });

    it('rejects a missing, unknown or expired token with 401 and clears the cookie', async () => {
      const missing = await post('refresh');
      expect(missing.status).toBe(401);
      expect(((await missing.json()) as any).error.code).toBe('UNAUTHENTICATED');
      expectCookieCleared(missing);

      const unknown = await post('refresh', { rt: 'not-a-real-token' });
      expect(unknown.status).toBe(401);
      expectCookieCleared(unknown);

      await login();
      const expiredRt = 'expired-refresh-token-for-test';
      await testApp.connection.collection('sessions').insertOne({
        userId: new Types.ObjectId(userId),
        refreshTokenHash: hashToken(expiredRt),
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        createdAt: new Date(),
      });
      const expired = await post('refresh', { rt: expiredRt });
      expect(expired.status).toBe(401);
      expectCookieCleared(expired);
    });

    it('rejects a wrong or missing Origin with 403 ORIGIN_NOT_ALLOWED', async () => {
      const rt = await login();

      const wrong = await post('refresh', { rt, origin: 'https://evil.example' });
      expect(wrong.status).toBe(403);
      expect(((await wrong.json()) as any).error.code).toBe('ORIGIN_NOT_ALLOWED');

      const missing = await post('refresh', { rt, origin: null });
      expect(missing.status).toBe(403);

      // The rejected requests must not have consumed the token
      expect((await post('refresh', { rt })).status).toBe(200);
    });
  });

  describe('logout', () => {
    it('ends only the current session and clears the cookie', async () => {
      const rt = await login();
      const otherDeviceRt = await login();

      const res = await post('logout', { rt });
      expect(res.status).toBe(204);
      expectCookieCleared(res);

      expect(await findSession(rt)).toBeNull();
      expect((await post('refresh', { rt })).status).toBe(401);
      expect((await post('refresh', { rt: otherDeviceRt })).status).toBe(200);
    });

    it('returns 204 without a cookie or with an unknown token', async () => {
      const noCookie = await post('logout');
      expect(noCookie.status).toBe(204);
      expectCookieCleared(noCookie);

      expect((await post('logout', { rt: 'not-a-real-token' })).status).toBe(204);
    });

    it('rejects a wrong Origin with 403 ORIGIN_NOT_ALLOWED and keeps the session', async () => {
      const rt = await login();

      const res = await post('logout', { rt, origin: 'https://evil.example' });
      expect(res.status).toBe(403);
      expect(((await res.json()) as any).error.code).toBe('ORIGIN_NOT_ALLOWED');
      expect(await findSession(rt)).not.toBeNull();
    });
  });

  // Last, because it soft-deletes the shared Google user
  it('refuses to refresh for a deleted user and removes that session', async () => {
    const rt = await login();
    await testApp.connection
      .collection('users')
      .updateOne({ _id: new Types.ObjectId(userId) }, { $set: { deletedAt: new Date() } });

    const res = await post('refresh', { rt });
    expect(res.status).toBe(401);
    expectCookieCleared(res);
    expect(await findSession(rt)).toBeNull();
  });
});
