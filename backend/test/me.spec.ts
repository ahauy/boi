import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { AuthProvider, ReferralStatus } from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import type { GoogleProfile } from '../src/auth/google-auth.verifier';

const JWT_SECRET = 'test-jwt-secret-palm-sight-at-least-32-chars-long';

const googleProfile: GoogleProfile = {
  sub: 'google-sub-me',
  email: 'me.user@example.com',
  emailVerified: true,
  name: 'Me User',
  picture: null,
};

describe('GET /api/v1/me + JwtAuthGuard', () => {
  let testApp: TestAppInstance;
  let accessToken: string;
  let userId: string;

  const getMe = (token?: string) =>
    fetch(`${testApp.baseUrl}/api/v1/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    testApp = await createTestApp({ googleVerifier: { verify: async () => googleProfile } });

    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'any' }),
    });
    const body = (await res.json()) as any;
    accessToken = body.accessToken;
    userId = body.user.id;
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('puts the session ID (sid) of an existing session into the access token', async () => {
    const payload = new JwtService({ secret: JWT_SECRET }).verify(accessToken);
    expect(payload.sub).toBe(userId);

    const session = await testApp.connection
      .collection('sessions')
      .findOne({ _id: new Types.ObjectId(payload.sid) });
    expect(session?.userId.toString()).toBe(userId);
  });

  it('returns the profile of the logged-in user', async () => {
    const res = await getMe(accessToken);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body).toMatchObject({
      id: userId,
      displayName: 'Me User',
      username: null,
      email: 'me.user@example.com',
      hasPassword: false,
      providers: [AuthProvider.GOOGLE],
      creditBalance: 3,
      referral: { canEnterCode: true, enteredCode: null },
    });
    expect(body.referralLink).toBe(`http://localhost:5173/r/${body.referralCode}`);
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('reports the referral code the user already entered', async () => {
    await testApp.connection.collection('referrals').insertOne({
      referrerId: new Types.ObjectId(),
      refereeId: new Types.ObjectId(userId),
      codeUsed: 'K7QX4MZP',
      status: ReferralStatus.REWARDED,
      createdAt: new Date(),
    });

    const body = (await (await getMe(accessToken)).json()) as any;
    expect(body.referral).toEqual({ canEnterCode: false, enteredCode: 'K7QX4MZP' });
  });

  it('rejects a request without a token with 401 UNAUTHENTICATED', async () => {
    const res = await getMe();
    expect(res.status).toBe(401);
    expect(((await res.json()) as any).error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a forged token with 401 UNAUTHENTICATED', async () => {
    const forged = new JwtService({ secret: 'some-other-secret-that-is-long-enough' }).sign({
      sub: userId,
      sid: 'x',
    });
    const res = await getMe(forged);
    expect(res.status).toBe(401);
    expect(((await res.json()) as any).error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an expired token with 401 TOKEN_EXPIRED', async () => {
    const expired = new JwtService({ secret: JWT_SECRET }).sign(
      { sub: userId, sid: 'x' },
      { expiresIn: -10 },
    );
    const res = await getMe(expired);
    expect(res.status).toBe(401);
    expect(((await res.json()) as any).error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a still-valid token once the user is deleted', async () => {
    await testApp.connection
      .collection('users')
      .updateOne({ _id: new Types.ObjectId(userId) }, { $set: { deletedAt: new Date() } });

    const res = await getMe(accessToken);
    expect(res.status).toBe(401);
    expect(((await res.json()) as any).error.code).toBe('UNAUTHENTICATED');
  });
});
