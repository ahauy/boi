import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { createTestApp, closeTestApp, createGuest, TestAppInstance } from './test-helper';

const JWT_SECRET = 'test-jwt-secret-palm-sight-at-least-32-chars-long';

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

describe('POST /auth/refresh', () => {
  let testApp: TestAppInstance;
  // Mỗi request một IP riêng để giới hạn 10 req/phút/IP không chạm giữa chừng
  let ipCounter = 0;

  const refresh = (rt?: string, ip?: string) => {
    const headers: Record<string, string> = {
      'X-Forwarded-For': ip ?? `10.0.0.${++ipCounter}`,
    };
    if (rt !== undefined) headers['x-refresh-token'] = rt;
    return fetch(`${testApp.baseUrl}/api/v1/auth/refresh`, { method: 'POST', headers });
  };

  const findSession = (rt: string) =>
    testApp.connection.collection('sessions').findOne({ refreshTokenHash: hashToken(rt) });

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('rotates the refresh token and issues an access token for the new session', async () => {
    const guest = await createGuest(testApp);
    const oldRt = guest.refreshToken;

    const res = await refresh(oldRt);
    expect(res.status).toBe(200);
    // Không còn cookie
    expect(res.headers.getSetCookie()).toEqual([]);

    const body = (await res.json()) as any;
    expect(Object.keys(body).sort()).toEqual(['accessToken', 'expiresIn', 'refreshToken']);
    expect(body.expiresIn).toBe(900);

    const newRt = body.refreshToken as string;
    expect(newRt).toBeTruthy();
    expect(newRt).not.toBe(oldRt);

    const newSession = await findSession(newRt);
    const payload = new JwtService({ secret: JWT_SECRET }).verify(body.accessToken);
    expect(payload.sub).toBe(guest.id);
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
    const guest = await createGuest(testApp);
    // Cùng deviceId nghĩa là cùng người dùng nhưng một phiên khác (thiết bị mở lại app)
    const other = await createGuest(testApp, { deviceId: guest.deviceId });
    expect(other.id).toBe(guest.id);

    const rotated = (await (await refresh(guest.refreshToken)).json()) as any;
    const newRt = rotated.refreshToken as string;

    const reuse = await refresh(guest.refreshToken);
    expect(reuse.status).toBe(401);
    expect(((await reuse.json()) as any).error.code).toBe('UNAUTHENTICATED');

    expect(
      await testApp.connection
        .collection('sessions')
        .countDocuments({ userId: new Types.ObjectId(guest.id) }),
    ).toBe(0);
    expect((await refresh(newRt)).status).toBe(401);
    expect((await refresh(other.refreshToken)).status).toBe(401);
  });

  it('lets only one of two concurrent refreshes with the same token succeed', async () => {
    const guest = await createGuest(testApp);
    const results = await Promise.all([refresh(guest.refreshToken), refresh(guest.refreshToken)]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 401]);
  });

  it('rejects a missing, unknown or expired token with 401', async () => {
    const missing = await refresh();
    expect(missing.status).toBe(401);
    expect(((await missing.json()) as any).error.code).toBe('UNAUTHENTICATED');

    const unknown = await refresh('not-a-real-token');
    expect(unknown.status).toBe(401);

    const guest = await createGuest(testApp);
    const expiredRt = 'expired-refresh-token-for-test';
    await testApp.connection.collection('sessions').insertOne({
      userId: new Types.ObjectId(guest.id),
      refreshTokenHash: hashToken(expiredRt),
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      createdAt: new Date(),
    });
    const expired = await refresh(expiredRt);
    expect(expired.status).toBe(401);
  });

  it('rate limits to 10 requests per minute per IP with 429 RATE_LIMITED', async () => {
    const ip = '10.200.0.1';
    for (let i = 0; i < 10; i++) {
      expect((await refresh('not-a-real-token', ip)).status).toBe(401);
    }
    const limited = await refresh('not-a-real-token', ip);
    expect(limited.status).toBe(429);
    expect(((await limited.json()) as any).error.code).toBe('RATE_LIMITED');
    expect(limited.headers.get('retry-after')).toBe('60');

    // IP khác không bị ảnh hưởng
    expect((await refresh('not-a-real-token', '10.200.0.2')).status).toBe(401);
  });

  it('refuses to refresh for a deleted user and removes that session', async () => {
    const guest = await createGuest(testApp);
    await testApp.connection
      .collection('users')
      .updateOne({ _id: new Types.ObjectId(guest.id) }, { $set: { deletedAt: new Date() } });

    const res = await refresh(guest.refreshToken);
    expect(res.status).toBe(401);
    expect(await findSession(guest.refreshToken)).toBeNull();
  });
});
