import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { Types } from 'mongoose';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

describe('POST /api/v1/auth/device', () => {
  let testApp: TestAppInstance;
  const firstDeviceId = crypto.randomUUID();
  let firstUserId: string;
  let firstAccessToken: string;

  const createSession = (deviceId: string) =>
    fetch(`${testApp.baseUrl}/api/v1/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client': 'native' },
      body: JSON.stringify({ deviceId }),
    });

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('creates an anonymous account with 3 free credits on first launch', async () => {
    const res = await createSession(firstDeviceId);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(true);
    expect(body.accessToken).toBeTruthy();
    // Mobile cần refresh token trong body để giữ phiên qua SecureStore
    expect(body.refreshToken).toBeTruthy();
    expect(body.user).toMatchObject({
      displayName: 'Khách',
      creditBalance: 3,
    });

    firstUserId = body.user.id;
    firstAccessToken = body.accessToken;

    const me = await fetch(`${testApp.baseUrl}/api/v1/me`, {
      headers: { Authorization: `Bearer ${firstAccessToken}` },
    });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      id: firstUserId,
      displayName: 'Khách',
      email: null,
      isAnonymous: true,
      creditBalance: 3,
      referral: { canEnterCode: true, enteredCode: null },
    });

    const bonus = await testApp.connection.collection('credit_transactions').findOne({
      userId: new Types.ObjectId(firstUserId),
    });
    expect(bonus).toMatchObject({ amount: 3, type: 'SIGNUP_BONUS', balanceAfter: 3 });
  });

  it('reopens the same account when the device returns with the same id', async () => {
    const res = await createSession(firstDeviceId);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(false);
    expect(body.user.id).toBe(firstUserId);

    const users = await testApp.connection
      .collection('users')
      .countDocuments({ isAnonymous: true });
    expect(users).toBe(1);
  });

  it('opens a new guest with no starter when the anonymous account has been deleted', async () => {
    await testApp.connection
      .collection('users')
      .updateOne({ _id: new Types.ObjectId(firstUserId) }, { $set: { deletedAt: new Date() } });

    const reopened = await createSession(firstDeviceId);
    expect(reopened.status).toBe(200);
    const body = (await reopened.json()) as any;
    expect(body.isNewUser).toBe(true);
    expect(body.user.id).not.toBe(firstUserId);
    expect(body.user.creditBalance).toBe(0);
  });

  it('rejects a missing or malformed device id with VALIDATION_ERROR', async () => {
    const missing = await createSession('');
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as any).error.code).toBe('VALIDATION_ERROR');

    const malformed = await createSession('short');
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as any).error.code).toBe('VALIDATION_ERROR');
  });

  it('caps anonymous account creation per IP at 3 per day', async () => {
    expect((await createSession(crypto.randomUUID())).status).toBe(200);

    const blocked = await createSession(crypto.randomUUID());
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as any).error.code).toBe('DEVICE_SESSION_LIMIT_REACHED');
  });
});
