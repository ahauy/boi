import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { AuthProvider, CreditTransactionType, DeletedIdentityKind } from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import type { FacebookProfile } from '../src/auth/facebook-auth.verifier';

const profiles: Record<string, FacebookProfile> = {
  'fb-token-new': {
    sub: 'fb-sub-new',
    email: 'new.facebook@example.com',
    emailVerified: true,
    name: 'Facebook New User',
    picture: 'https://graph.facebook.com/fb-sub-new/picture',
  },
  'fb-token-password-user': {
    sub: 'fb-sub-password-user',
    email: 'password.fb.user@example.com',
    emailVerified: true,
    name: 'Password User On Facebook',
    picture: null,
  },
  'fb-token-no-email': {
    sub: 'fb-sub-no-email',
    email: null,
    emailVerified: false,
    name: null,
    picture: null,
  },
  'fb-token-deleted': {
    sub: 'fb-sub-deleted',
    email: 'recycled.fb@example.com',
    emailVerified: true,
    name: 'Recycled FB',
    picture: null,
  },
};

const fakeFacebookVerifier = {
  verify: async (accessToken: string): Promise<FacebookProfile> => {
    const profile = profiles[accessToken];
    if (!profile) {
      throw new UnauthorizedException({
        code: 'OAUTH_INVALID_TOKEN',
        message: 'Không xác minh được tài khoản Facebook. Vui lòng thử lại.',
      });
    }
    return profile;
  },
};

describe('POST /api/v1/auth/facebook', () => {
  let testApp: TestAppInstance;

  const postFacebook = (body: unknown) =>
    fetch(`${testApp.baseUrl}/api/v1/auth/facebook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeAll(async () => {
    testApp = await createTestApp({ facebookVerifier: fakeFacebookVerifier });

    await testApp.connection.collection('users').insertMany([
      {
        displayName: 'Password User',
        username: 'password_fb_user',
        email: 'password.fb.user@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$existinghash',
        referralCode: 'FBPW2345',
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
      .update(`${DeletedIdentityKind.FACEBOOK}:fb-sub-deleted`)
      .digest('hex');
    await testApp.connection.collection('deleted_identities').insertOne({
      kind: DeletedIdentityKind.FACEBOOK,
      valueHmac: subHmac,
      deletedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    });
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('creates a new user with SIGNUP_BONUS on first Facebook login', async () => {
    const res = await postFacebook({ accessToken: 'fb-token-new' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(true);
    expect(body.accessToken).toBeTruthy();
    expect(body.user.creditBalance).toBe(3);
    expect(body.user.username).toBeNull();
    expect(body.user.avatarUrl).toBe('https://graph.facebook.com/fb-sub-new/picture');
    expect(res.headers.get('set-cookie')).toContain('rt=');

    const user = await testApp.connection.collection('users').findOne({ email: 'new.facebook@example.com' });
    expect(user?.passwordHash ?? null).toBeNull();
    expect(user?.identities).toHaveLength(1);
    expect(user?.identities[0]).toMatchObject({ provider: AuthProvider.FACEBOOK, providerUserId: 'fb-sub-new' });

    const bonuses = await testApp.connection
      .collection('credit_transactions')
      .countDocuments({ userId: user!._id, type: CreditTransactionType.SIGNUP_BONUS });
    expect(bonuses).toBe(1);
  });

  it('logs the same Facebook account into the existing user without another bonus', async () => {
    const res = await postFacebook({ accessToken: 'fb-token-new' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(false);
    expect(body.user.creditBalance).toBe(3);

    const count = await testApp.connection.collection('users').countDocuments({ email: 'new.facebook@example.com' });
    expect(count).toBe(1);
  });

  it('links Facebook to an existing password account with the same verified email', async () => {
    const res = await postFacebook({ accessToken: 'fb-token-password-user' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(false);
    expect(body.user.username).toBe('password_fb_user');
    expect(body.user.creditBalance).toBe(3);

    const user = await testApp.connection.collection('users').findOne({ email: 'password.fb.user@example.com' });
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.identities).toHaveLength(1);
    expect(user?.identities[0].providerUserId).toBe('fb-sub-password-user');
  });

  it('creates a Facebook user without email when Facebook does not provide email', async () => {
    const res = await postFacebook({ accessToken: 'fb-token-no-email' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(true);

    const fbUser = await testApp.connection
      .collection('users')
      .findOne({ 'identities.providerUserId': 'fb-sub-no-email' });
    expect(fbUser?.email ?? null).toBeNull();
    expect(fbUser?.displayName).toBe('Người dùng Facebook');
  });

  it('gives 0 credits and blocks referrals when the Facebook ID was deleted before', async () => {
    const res = await postFacebook({ accessToken: 'fb-token-deleted' });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(true);
    expect(body.user.creditBalance).toBe(0);

    const user = await testApp.connection.collection('users').findOne({ email: 'recycled.fb@example.com' });
    expect(user?.referralBlocked).toBe(true);
  });

  it('rejects an invalid Facebook token with 401 OAUTH_INVALID_TOKEN', async () => {
    const res = await postFacebook({ accessToken: 'forged-token' });
    expect(res.status).toBe(401);

    const body = (await res.json()) as any;
    expect(body.error.code).toBe('OAUTH_INVALID_TOKEN');
  });

  it('rejects a missing accessToken with 400 VALIDATION_ERROR', async () => {
    const res = await postFacebook({});
    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
