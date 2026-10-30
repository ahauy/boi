import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';

describe('POST /api/v1/auth/resend-verification (TC-014)', () => {
  let testApp: TestAppInstance;
  const existingEmail = 'user_resend@example.com';
  const oldTokenHash = 'b'.repeat(64);

  beforeAll(async () => {
    testApp = await createTestApp();

    const pendingCollection = testApp.connection.collection('pending_registrations');
    await pendingCollection.insertOne({
      displayName: 'User Resend',
      username: 'user_resend',
      email: existingEmail,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      tokenHash: oldTokenHash,
      expiresAt: new Date(Date.now() + 10 * 3600 * 1000), // ~10h remaining
      createdAt: new Date(),
    });
  }, 30000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('TC-014: should resend verification email, extend TTL by 24h, and preserve anti-enumeration on unknown email', async () => {
    // 1. Resend for existing pending user
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: existingEmail }),
    });

    expect(res.status).toBe(202);
    const text = await res.text();
    expect(text).toBe('');

    // Verify tokenHash updated & expiresAt extended
    const pendingCollection = testApp.connection.collection('pending_registrations');
    const updated = await pendingCollection.findOne({ email: existingEmail });
    expect(updated).toBeDefined();
    expect(updated!.tokenHash).not.toBe(oldTokenHash);
    expect(updated!.tokenHash).toHaveLength(64);
    expect(new Date(updated!.expiresAt).getTime()).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);

    // Verify mail received
    const sent = testApp.sentEmails.find((e) => e.to === existingEmail);
    expect(sent).toBeDefined();
    expect(sent!.displayName).toBe('User Resend');

    // 2. Resend for non-existent email (anti-enumeration check)
    const ghostEmail = 'ghost@example.com';
    const ghostRes = await fetch(`${testApp.baseUrl}/api/v1/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ghostEmail }),
    });

    expect(ghostRes.status).toBe(202);
    const ghostText = await ghostRes.text();
    expect(ghostText).toBe('');

    // Ensure no email was sent to ghost
    const ghostSent = testApp.sentEmails.find((e) => e.to === ghostEmail);
    expect(ghostSent).toBeUndefined();
  });
});
