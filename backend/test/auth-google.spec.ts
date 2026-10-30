import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import {
  AuthProvider, CreditTransactionType, DeletedIdentityKind,
  ReadingStatus, ReadingSchool, HandOrientation,
} from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import type { GoogleProfile } from '../src/auth/google-auth.verifier';

const profiles: Record<string, GoogleProfile> = {
  'token-new': {
    sub: 'google-sub-new',
    email: 'new.google@example.com',
    emailVerified: true,
    name: 'Google New User',
    picture: 'https://lh3.googleusercontent.com/new.jpg',
  },
  'token-password-user': {
    sub: 'google-sub-password-user',
    email: 'password.user@example.com',
    emailVerified: true,
    name: 'Password User On Google',
    picture: null,
  },
  'token-unverified': {
    sub: 'google-sub-unverified',
    email: 'unverified.owner@example.com',
    emailVerified: false,
    name: null,
    picture: null,
  },
  'token-deleted': {
    sub: 'google-sub-deleted',
    email: 'recycled.google@example.com',
    emailVerified: true,
    name: 'Recycled',
    picture: null,
  },
  'token-claim': {
    sub: 'google-sub-claim',
    email: 'claim.google@example.com',
    emailVerified: true,
    name: 'Google Claim User',
    picture: null,
  },
};

const fakeGoogleVerifier = {
  verify: async (idToken: string): Promise<GoogleProfile> => {
    const profile = profiles[idToken];
    if (!profile) {
      throw new UnauthorizedException({
        code: 'OAUTH_INVALID_TOKEN',
        message: 'Không xác minh được tài khoản Google. Vui lòng thử lại.',
      });
    }
    return profile;
  },
  verifyCode: async (code: string): Promise<GoogleProfile> =>
    fakeGoogleVerifier.verify(code.replace(/^code-/, 'token-')),
};

describe('POST /api/v1/auth/google', () => {
  let testApp: TestAppInstance;

  const postGoogle = (body: unknown) =>
    fetch(`${testApp.baseUrl}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeAll(async () => {
    testApp = await createTestApp({ googleVerifier: fakeGoogleVerifier });

    await testApp.connection.collection('users').insertMany([
      {
        displayName: 'Password User',
        username: 'password_user',
        email: 'password.user@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$existinghash',
        referralCode: 'PASS2345',
        creditBalance: 3,
        identities: [],
        referralBlocked: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        displayName: 'Unverified Owner',
        username: 'unverified_owner',
        email: 'unverified.owner@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$ownerhash',
        referralCode: 'OWNR2345',
        creditBalance: 3,
        identities: [],
        referralBlocked: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const subHmac = crypto
      .createHmac('sha256', 'test-identity-secret-at-least-32-chars-long')
      .update(`${DeletedIdentityKind.GOOGLE}:google-sub-deleted`)
      .digest('hex');
    await testApp.connection.collection('deleted_identities').insertOne({
      kind: DeletedIdentityKind.GOOGLE,
      valueHmac: subHmac,
      deletedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    });
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('creates a new user with SIGNUP_BONUS on first Google login', async () => {
    const res = await postGoogle({ idToken: 'token-new' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(true);
    expect(body.accessToken).toBeTruthy();
    expect(body.user.creditBalance).toBe(3);
    expect(body.user.username).toBeNull();
    expect(body.user.avatarUrl).toBe('https://lh3.googleusercontent.com/new.jpg');
    expect(res.headers.get('set-cookie')).toContain('rt=');

    const user = await testApp.connection.collection('users').findOne({ email: 'new.google@example.com' });
    expect(user?.passwordHash ?? null).toBeNull();
    expect(user?.identities).toHaveLength(1);
    expect(user?.identities[0]).toMatchObject({ provider: AuthProvider.GOOGLE, providerUserId: 'google-sub-new' });

    const bonuses = await testApp.connection
      .collection('credit_transactions')
      .countDocuments({ userId: user!._id, type: CreditTransactionType.SIGNUP_BONUS });
    expect(bonuses).toBe(1);
  });

  it('logs the same Google account into the existing user without another bonus', async () => {
    const res = await postGoogle({ idToken: 'token-new' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(false);
    expect(body.user.creditBalance).toBe(3);

    const count = await testApp.connection.collection('users').countDocuments({ email: 'new.google@example.com' });
    expect(count).toBe(1);
  });

  it('links Google to an existing password account with the same verified email', async () => {
    const res = await postGoogle({ idToken: 'token-password-user' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(false);
    expect(body.user.username).toBe('password_user');
    expect(body.user.creditBalance).toBe(3);

    const user = await testApp.connection.collection('users').findOne({ email: 'password.user@example.com' });
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.identities).toHaveLength(1);
    expect(user?.identities[0].providerUserId).toBe('google-sub-password-user');

    const bonuses = await testApp.connection
      .collection('credit_transactions')
      .countDocuments({ userId: user!._id });
    expect(bonuses).toBe(0);
  });

  it('does not merge by email when Google has not verified it', async () => {
    const res = await postGoogle({ idToken: 'token-unverified' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(true);

    const owner = await testApp.connection.collection('users').findOne({ username: 'unverified_owner' });
    expect(owner?.identities).toHaveLength(0);

    const googleUser = await testApp.connection
      .collection('users')
      .findOne({ 'identities.providerUserId': 'google-sub-unverified' });
    expect(googleUser?.email ?? null).toBeNull();
    expect(googleUser?.displayName).toBe('Người dùng Google');
  });

  it('gives 0 credits and blocks referrals when the Google ID was deleted before', async () => {
    const res = await postGoogle({ idToken: 'token-deleted' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(true);
    expect(body.user.creditBalance).toBe(0);

    const user = await testApp.connection.collection('users').findOne({ email: 'recycled.google@example.com' });
    expect(user?.referralBlocked).toBe(true);
  });

  it('rejects an invalid Google token with 401 OAUTH_INVALID_TOKEN', async () => {
    const res = await postGoogle({ idToken: 'forged-token' });
    expect(res.status).toBe(401);

    const body = (await res.json()) as any;
    expect(body.error.code).toBe('OAUTH_INVALID_TOKEN');
  });

  it('logs in with an authorization code from the custom Google button', async () => {
    const res = await postGoogle({ code: 'code-new' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(false);
    expect(body.accessToken).toBeTruthy();
  });

  it('rejects an invalid authorization code with 401 OAUTH_INVALID_TOKEN', async () => {
    const res = await postGoogle({ code: 'code-forged' });
    expect(res.status).toBe(401);

    const body = (await res.json()) as any;
    expect(body.error.code).toBe('OAUTH_INVALID_TOKEN');
  });

  it('rejects a missing idToken with 400 VALIDATION_ERROR', async () => {
    const res = await postGoogle({});
    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('claims a guest trial reading when valid claimToken is provided with Google login', async () => {
    const claimToken = crypto.randomUUID();
    const guestTokenHash = crypto.createHash('sha256').update(claimToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const readingInsert = await testApp.connection.collection('readings').insertOne({
      userId: null,
      isGuest: true,
      idempotencyKey: crypto.randomUUID(),
      guestTokenHash,
      school: ReadingSchool.WESTERN,
      topics: ['lifeLine'],
      hand: HandOrientation.LEFT,
      status: ReadingStatus.GUEST_PREVIEW,
      previewExpiresAt: expiresAt,
      createdAt: new Date(),
    });

    await testApp.connection.collection('guest_trials').insertOne({
      fingerprintHash: crypto.randomBytes(32).toString('hex'),
      ipHash: crypto.randomBytes(32).toString('hex'),
      guestTokenHash,
      readingId: readingInsert.insertedId,
      isClaimed: false,
      expiresAt,
      createdAt: new Date(),
    });

    const res = await postGoogle({ idToken: 'token-claim', claimToken });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.claimedReadingId).toBe(readingInsert.insertedId.toString());
    expect(body.claimFailed).toBeUndefined();
    expect(body.user.creditBalance).toBe(2); // 3 welcome bonus - 1 spent for reading = 2

    // Verify reading was updated to DONE
    const updatedReading = await testApp.connection.collection('readings').findOne({ _id: readingInsert.insertedId });
    expect(updatedReading?.status).toBe(ReadingStatus.DONE);
    expect(updatedReading?.claimedAt).toBeDefined();

    // Verify guest trial was marked isClaimed
    const updatedTrial = await testApp.connection.collection('guest_trials').findOne({ guestTokenHash });
    expect(updatedTrial?.isClaimed).toBe(true);
  });
});
