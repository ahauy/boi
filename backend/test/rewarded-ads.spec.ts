import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Types } from 'mongoose';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { buildSignedContent } from '../src/ads/rewarded-ad-ssv.verifier';

/**
 * Test chạy thật entire chuỗi ký -> xác minh: tự sinh một cặp khoá EC, phát khoá qua một HTTP
 * server giả, ký callback bằng Node crypto rồi đòi backend phải chấp nhận.
 *
 * Lưu ý trung thực: phần này chứng minh verifier *tự nhất quán* và không im lặng từ chối mọi thứ.
 * Nó không chứng minh canonical string của ta trùng với cái AdMob thực sự ký. Callback SSV đầu
 * tiên từ traffic thật vẫn phải được đối chiếu một lần ở môi trường staging.
 */

const KEY_ID = '4081516420';

describe('Rewarded ads: SSV + credit caps', () => {
  let testApp: TestAppInstance;
  let keyServer: http.Server;
  let privateKey: crypto.KeyObject;
  let accessToken: string;
  let userId: string;

  const api = (path: string, init?: RequestInit & { token?: string }) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-client': 'native',
      ...(init?.headers as Record<string, string>),
    };
    if (init?.token ?? accessToken) {
      headers.Authorization = `Bearer ${init?.token ?? accessToken}`;
    }
    return fetch(`${testApp.baseUrl}/api/v1${path}`, { ...init, headers });
  };

  const balance = async () => {
    const res = await api('/me');
    return ((await res.json()) as any).creditBalance as number;
  };

  /**
   * Thứ tự tham số cố tình lộn xộn để bắt buộc verifier phải sắp xếp lại như tài liệu AdMob,
   * và giá trị được percent-encode để bắt buộc nó phải giải mã trước khi ký.
   */
  function signedVerifyUrl(params: Record<string, string>, tamperSignature = false): string {
    const pairs = Object.entries(params);
    const content = buildSignedContent(pairs);
    const der = crypto.sign('sha256', Buffer.from(content, 'utf8'), privateKey);
    const signature = tamperSignature
      ? Buffer.from(der.slice(0, der.length - 4)).toString('base64url')
      : der.toString('base64url');

    const query = pairs
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    return (
      `/ads/rewarded/verify?${query}` +
      `&signature=${encodeURIComponent(signature)}` +
      `&key_id=${KEY_ID}`
    );
  }

  const newIntent = async (placement = 'wallet') => {
    const res = await api('/ads/rewarded/intent', {
      method: 'POST',
      body: JSON.stringify({ placement }),
    });
    return { res, body: ((await res.json()) as any) };
  };

  const rewardParams = (nonce: string, overrides: Record<string, string> = {}) => ({
    // ad_network/transaction_id/reward_* là những gì Google nhồi vào callback
    'ad_network': '1',
    'reward_amount': '1',
    'reward_item': 'palmsight-credit',
    'custom_data': 'test',
    'transaction_id': crypto.randomUUID(),
    'user_id': nonce,
    ...overrides,
  });

  beforeAll(async () => {
    const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    privateKey = pair.privateKey;
    const pem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

    keyServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          keys: [
            {
              keyId: Number(KEY_ID),
              pem,
              hashAlgorithm: 'SHA-256',
              signatureAlgorithm: 'ECDSA',
            },
          ],
        })
      );
    });
    await new Promise<void>((resolve) => keyServer.listen(0, '127.0.0.1', resolve));
    const keysUrl = `http://127.0.0.1:${(keyServer.address() as AddressInfo).port}/keys.json`;

    testApp = await createTestApp({ adSsvKeysUrl: keysUrl, rewardedAdsEnabled: true });

    const session = await fetch(`${testApp.baseUrl}/api/v1/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client': 'native' },
      body: JSON.stringify({ deviceId: crypto.randomUUID() }),
    });
    const body = (await session.json()) as any;
    accessToken = body.accessToken;
    userId = body.user.id;
  }, 60000);

  afterAll(async () => {
    keyServer?.close();
    await closeTestApp(testApp);
  });

  it('POST /ads/rewarded/intent requires a session', async () => {
    const res = await api('/ads/rewarded/intent', {
      method: 'POST',
      body: JSON.stringify({ placement: 'wallet' }),
      token: '',
    });
    expect(res.status).toBe(401);
  });

  it('reports availability with the daily budget untouched', async () => {
    const res = await api('/ads/rewarded/availability');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      enabled: true,
      creditsPerAd: 1,
      dailyCap: 3,
      remainingToday: 3,
    });
  });

  it('grants one credit when Google delivers a correctly signed callback', async () => {
    const { body: intent } = await newIntent();
    expect(intent.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(intent.remainingToday).toBe(2);

    const res = await api(signedVerifyUrl(rewardParams(intent.nonce)));
    expect(res.status).toBe(200);

    expect(await balance()).toBe(4);

    const tx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: new Types.ObjectId(userId), type: 'REWARDED_AD' });
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBe(1);

    const claim = await testApp.connection
      .collection('rewarded_ad_claims')
      .findOne({ nonce: intent.nonce });
    expect(claim!.status).toBe('REDEEMED');

    const status = await api(`/ads/rewarded/status?nonce=${intent.nonce}`);
    await expect(status.json()).resolves.toMatchObject({
      status: 'REDEEMED',
      creditsEarned: 1,
      creditBalance: 4,
      remainingToday: 2,
    });
  });

  it('does not pay twice when Google retries the same callback', async () => {
    const { body: intent } = await newIntent();
    const params = rewardParams(intent.nonce);
    const url = signedVerifyUrl(params);

    expect((await api(url)).status).toBe(200);
    const afterFirst = await balance();

    // Retry của Google gửi lại đúng URL, gồm cả transaction_id
    expect((await api(signedVerifyUrl(params))).status).toBe(200);
    expect(await balance()).toBe(afterFirst);

    const txCount = await testApp.connection
      .collection('credit_transactions')
      .countDocuments({ userId: new Types.ObjectId(userId), type: 'REWARDED_AD' });
    expect(txCount).toBe(2);
  });

  it('rejects a callback whose signature does not match the content', async () => {
    const before = await balance();
    const res = await api(
      signedVerifyUrl(rewardParams('a'.repeat(32)), true)
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('AD_SSV_SIGNATURE_INVALID');
    expect(await balance()).toBe(before);
  });

  it('rejects a validly signed callback that promises a foreign reward item', async () => {
    const before = await balance();
    const res = await api(
      signedVerifyUrl(rewardParams('b'.repeat(32), { reward_item: 'some-other-app-coin' }))
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error.code).toBe('AD_SSV_REWARD_MISMATCH');
    expect(await balance()).toBe(before);
  });

  it('rejects a correctly signed callback for a nonce the server never issued', async () => {
    const before = await balance();
    const res = await api(signedVerifyUrl(rewardParams('c'.repeat(32))));
    expect(res.status).toBe(404);
    expect(await balance()).toBe(before);
  });

  it('refuses to pay an expired intent instead of leaving it open forever', async () => {
    const { body: intent } = await newIntent();
    await testApp.connection
      .collection('rewarded_ad_claims')
      .updateOne(
        { nonce: intent.nonce },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

    const before = await balance();
    const res = await api(signedVerifyUrl(rewardParams(intent.nonce)));
    // 200 để Google ngừng retry, nhưng không cộng credit
    expect(res.status).toBe(200);
    expect(await balance()).toBe(before);

    const claim = await testApp.connection
      .collection('rewarded_ad_claims')
      .findOne({ nonce: intent.nonce });
    expect(claim!.status).toBe('ISSUED');
  });

  it('blocks the fourth intent once the 24h budget is spent', async () => {
    // Ba intent trước đã dùng hoặc đã hết hạn; cả ba vẫn tính vì cửa sổ đếm theo createdAt
    const { res, body } = await newIntent();
    expect(res.status).toBe(429);
    expect(body.error.code).toBe('REWARDED_AD_CAP_REACHED');
  });
});
