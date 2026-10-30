import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import {
  AuthProvider,
  CreditTransactionType,
  DeletedIdentityKind,
  HandOrientation,
  ReadingSchool,
  ReadingStatus,
} from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { deleteUserAccount, parseArgs } from '../scripts/users-delete';
import { reconcileCreditLedger, runCreditsReconciliation } from '../scripts/credits-reconcile';

const JWT_SECRET = 'test-jwt-secret-palm-sight-at-least-32-chars-long';
const IDENTITY_SECRET = 'test-identity-secret-at-least-32-chars-long';

describe('US-ACCT-001: Manual Account Deletion & Credit Reconciliation', () => {
  let testApp: TestAppInstance;

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it('deletes user successfully: anonymizes user, wipes sessions, password resets, reading results, and records HMACs', async () => {
    const userId = new Types.ObjectId();
    const email = 'user.to.delete@example.com';
    const googleUid = 'google_uid_delete_123';
    const referralCode = 'DEL00001';

    // 1. Seed user
    await testApp.connection.collection('users').insertOne({
      _id: userId,
      displayName: 'User To Delete',
      username: 'usertodelete',
      email,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      passwordUpdatedAt: new Date(),
      avatarUrl: 'https://example.com/avatar.jpg',
      referralCode,
      creditBalance: 3,
      identities: [
        {
          provider: AuthProvider.GOOGLE,
          providerUserId: googleUid,
          email,
          linkedAt: new Date(),
        },
      ],
      referralBlocked: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Seed credit transaction
    await testApp.connection.collection('credit_transactions').insertOne({
      userId,
      amount: 3,
      type: CreditTransactionType.SIGNUP_BONUS,
      balanceAfter: 3,
      createdAt: new Date(),
    });

    // 3. Seed session
    await testApp.connection.collection('sessions').insertOne({
      userId,
      refreshTokenHash: 'mock-session-refresh-token-hash',
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      createdAt: new Date(),
    });

    // 4. Seed password reset
    await testApp.connection.collection('password_resets').insertOne({
      userId,
      tokenHash: 'mock-password-reset-token-hash',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      createdAt: new Date(),
    });

    // 5. Seed reading with result
    const readingId = new Types.ObjectId();
    await testApp.connection.collection('readings').insertOne({
      _id: readingId,
      userId,
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      school: ReadingSchool.WESTERN,
      topics: ['heartLine'],
      hand: HandOrientation.LEFT,
      status: ReadingStatus.DONE,
      result: {
        dominantHand: 'LEFT',
        confidence: 0.95,
        summary: 'Detailed palm reading result that must be wiped',
      },
      deletedAt: null,
      createdAt: new Date(),
    });

    // Verify credit ledger is reconciled before deletion
    const beforeReconcile = await reconcileCreditLedger(testApp.connection);
    expect(beforeReconcile.ok).toBe(true);

    // Run deleteUserAccount
    const result = await deleteUserAccount(
      testApp.connection,
      userId,
      'Support request via email ticket #987',
      IDENTITY_SECRET,
    );

    expect(result.ok).toBe(true);
    expect(result.identitiesRecorded).toBe(2); // email + google identity

    // Assert user document is anonymized
    const userDoc = await testApp.connection.collection('users').findOne({ _id: userId });
    expect(userDoc).toBeDefined();
    expect(userDoc!.displayName).toBe('Người dùng đã xoá');
    expect(userDoc!.username).toBeNull();
    expect(userDoc!.email).toBeNull();
    expect(userDoc!.passwordHash).toBeNull();
    expect(userDoc!.avatarUrl).toBeNull();
    expect(userDoc!.identities).toEqual([]);
    expect(userDoc!.deletedAt).toBeInstanceOf(Date);

    // Invariants preserved: _id, creditBalance, referralCode
    expect(userDoc!._id.toString()).toBe(userId.toString());
    expect(userDoc!.creditBalance).toBe(3);
    expect(userDoc!.referralCode).toBe(referralCode);

    // Sessions and password resets wiped
    const sessionsCount = await testApp.connection.collection('sessions').countDocuments({ userId });
    expect(sessionsCount).toBe(0);

    const passwordResetsCount = await testApp.connection.collection('password_resets').countDocuments({ userId });
    expect(passwordResetsCount).toBe(0);

    // Reading result wiped and marked deletedAt
    const readingDoc = await testApp.connection.collection('readings').findOne({ _id: readingId });
    expect(readingDoc).toBeDefined();
    expect(readingDoc!.result).toBeNull();
    expect(readingDoc!.deletedAt).toBeInstanceOf(Date);

    // Deleted identities recorded with HMAC
    const expectedEmailHmac = crypto
      .createHmac('sha256', IDENTITY_SECRET)
      .update(email.toLowerCase())
      .digest('hex');

    const expectedGoogleHmac = crypto
      .createHmac('sha256', IDENTITY_SECRET)
      .update(`${AuthProvider.GOOGLE}:${googleUid}`)
      .digest('hex');

    const emailDeletedRecord = await testApp.connection
      .collection('deleted_identities')
      .findOne({ valueHmac: expectedEmailHmac });
    expect(emailDeletedRecord).toBeDefined();
    expect(emailDeletedRecord!.kind).toBe(DeletedIdentityKind.EMAIL);
    expect(emailDeletedRecord!.deletedAt).toBeInstanceOf(Date);

    const googleDeletedRecord = await testApp.connection
      .collection('deleted_identities')
      .findOne({ valueHmac: expectedGoogleHmac });
    expect(googleDeletedRecord).toBeDefined();
    expect(googleDeletedRecord!.kind).toBe(DeletedIdentityKind.GOOGLE);
    expect(googleDeletedRecord!.deletedAt).toBeInstanceOf(Date);

    // Verify credit ledger remains reconciled after deletion
    const afterReconcile = await reconcileCreditLedger(testApp.connection);
    expect(afterReconcile.ok).toBe(true);
    expect(afterReconcile.mismatches).toHaveLength(0);
  });

  it('prevents access: after deletion, JwtAuthGuard rejects user token with 401 UNAUTHENTICATED', async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId().toString();

    // Seed active user
    await testApp.connection.collection('users').insertOne({
      _id: userId,
      displayName: 'Active User Before Delete',
      username: 'active_before_delete',
      email: 'guard.check@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      referralCode: 'GRD00001',
      creditBalance: 3,
      identities: [],
      referralBlocked: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await testApp.connection.collection('credit_transactions').insertOne({
      userId,
      amount: 3,
      type: CreditTransactionType.SIGNUP_BONUS,
      balanceAfter: 3,
      createdAt: new Date(),
    });

    // Generate valid access token
    const jwtService = new JwtService({ secret: JWT_SECRET });
    const token = jwtService.sign({ sub: userId.toString(), sid: sessionId });

    // Verify token works before deletion
    const resBefore = await fetch(`${testApp.baseUrl}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resBefore.status).toBe(200);

    // Delete user
    await deleteUserAccount(testApp.connection, userId, 'Security test deletion', IDENTITY_SECRET);

    // Verify JwtAuthGuard rejects access token with 401 UNAUTHENTICATED
    const resAfter = await fetch(`${testApp.baseUrl}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resAfter.status).toBe(401);
    const body = (await resAfter.json()) as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('anti-abuse protection: creating a new user or verifying email with deleted email starts with 0 credits and referralBlocked: true (no SIGNUP_BONUS)', async () => {
    const deletedEmail = 'antiabuse.deleted@example.com';
    const deletedUserId = new Types.ObjectId();

    // Seed original user and delete them
    await testApp.connection.collection('users').insertOne({
      _id: deletedUserId,
      displayName: 'Original User',
      username: 'original_user',
      email: deletedEmail,
      passwordHash: '$argon2id$somehash',
      referralCode: 'ORIG0001',
      creditBalance: 3,
      identities: [],
      referralBlocked: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await testApp.connection.collection('credit_transactions').insertOne({
      userId: deletedUserId,
      amount: 3,
      type: CreditTransactionType.SIGNUP_BONUS,
      balanceAfter: 3,
      createdAt: new Date(),
    });

    await deleteUserAccount(testApp.connection, deletedUserId, 'Testing anti-abuse', IDENTITY_SECRET);

    // Now re-register with the same email
    const reRegisterToken = 'RE_REGISTER_TOKEN_012345678901234567890123456789';
    const reRegisterTokenHash = crypto.createHash('sha256').update(reRegisterToken).digest('hex');

    await testApp.connection.collection('pending_registrations').insertOne({
      displayName: 'Re-registered User',
      username: 'reregistered_user',
      email: deletedEmail,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$newhash',
      referralCode: null,
      tokenHash: reRegisterTokenHash,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      createdAt: new Date(),
    });

    const verifyRes = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: reRegisterToken }),
    });

    expect(verifyRes.status).toBe(200);
    const verifyData = (await verifyRes.json()) as any;
    expect(verifyData.user.creditBalance).toBe(0);

    const reCreatedUser = await testApp.connection
      .collection('users')
      .findOne({ email: deletedEmail });

    expect(reCreatedUser).toBeDefined();
    expect(reCreatedUser!.creditBalance).toBe(0);
    expect(reCreatedUser!.referralBlocked).toBe(true);

    // Verify NO SIGNUP_BONUS credit transaction was created
    const tx = await testApp.connection
      .collection('credit_transactions')
      .findOne({ userId: reCreatedUser!._id, type: CreditTransactionType.SIGNUP_BONUS });
    expect(tx).toBeNull();
  });

  it('cannot delete already deleted user (throws error / fails gracefully)', async () => {
    const userId = new Types.ObjectId();
    await testApp.connection.collection('users').insertOne({
      _id: userId,
      displayName: 'Already Deleted',
      username: null,
      email: null,
      passwordHash: null,
      avatarUrl: null,
      referralCode: 'ALRD0001',
      creditBalance: 0,
      identities: [],
      referralBlocked: true,
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      deleteUserAccount(testApp.connection, userId, 'Attempting duplicate delete', IDENTITY_SECRET),
    ).rejects.toThrow(/not found or already deleted/i);

    // Invalid ObjectId should also throw
    await expect(
      deleteUserAccount(testApp.connection, 'invalid-object-id', 'Note', IDENTITY_SECRET),
    ).rejects.toThrow(/invalid user id/i);

    // Non-existent user should also throw
    const nonExistentId = new Types.ObjectId();
    await expect(
      deleteUserAccount(testApp.connection, nonExistentId, 'Note', IDENTITY_SECRET),
    ).rejects.toThrow(/not found or already deleted/i);
  });

  it('reconcile credit ledger: confirms credit ledger remains in sync before and after user deletion', async () => {
    const userId = new Types.ObjectId();

    await testApp.connection.collection('users').insertOne({
      _id: userId,
      displayName: 'Reconcile Test User',
      username: 'reconcile_user',
      email: 'reconcile.user@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
      referralCode: 'RCON0001',
      creditBalance: 2,
      identities: [],
      referralBlocked: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await testApp.connection.collection('credit_transactions').insertMany([
      {
        userId,
        amount: 3,
        type: CreditTransactionType.SIGNUP_BONUS,
        balanceAfter: 3,
        createdAt: new Date(),
      },
      {
        userId,
        amount: -1,
        type: CreditTransactionType.READING_SPEND,
        balanceAfter: 2,
        createdAt: new Date(),
      },
    ]);

    const check1 = await reconcileCreditLedger(testApp.connection);
    expect(check1.ok).toBe(true);

    await deleteUserAccount(testApp.connection, userId, 'Reconcile verification', IDENTITY_SECRET);

    const check2 = await reconcileCreditLedger(testApp.connection);
    expect(check2.ok).toBe(true);
    expect(check2.mismatches).toHaveLength(0);

    // Test runCreditsReconciliation runner end-to-end
    const runnerSuccess = await runCreditsReconciliation(testApp.replSet.getUri());
    expect(runnerSuccess).toBe(true);
  });

  describe('CLI arguments parser (users-delete)', () => {
    it('parses --user and --note correctly with separated args', () => {
      const parsed = parseArgs(['--user', '653a1f2b3c4d5e6f7a8b9c0d', '--note', 'Support ticket #101']);
      expect(parsed.userId).toBe('653a1f2b3c4d5e6f7a8b9c0d');
      expect(parsed.note).toBe('Support ticket #101');
    });

    it('parses -u and -n shorthand args', () => {
      const parsed = parseArgs(['-u', '653a1f2b3c4d5e6f7a8b9c0d', '-n', 'GDPR Request']);
      expect(parsed.userId).toBe('653a1f2b3c4d5e6f7a8b9c0d');
      expect(parsed.note).toBe('GDPR Request');
    });

    it('parses --user=id and --note=text syntax', () => {
      const parsed = parseArgs(['--user=653a1f2b3c4d5e6f7a8b9c0d', '--note=Deletion reason']);
      expect(parsed.userId).toBe('653a1f2b3c4d5e6f7a8b9c0d');
      expect(parsed.note).toBe('Deletion reason');
    });

    it('parses -u=id and -n=text syntax', () => {
      const parsed = parseArgs(['-u=653a1f2b3c4d5e6f7a8b9c0d', '-n=Short reason']);
      expect(parsed.userId).toBe('653a1f2b3c4d5e6f7a8b9c0d');
      expect(parsed.note).toBe('Short reason');
    });

    it('returns undefined when args are not provided', () => {
      const parsed = parseArgs([]);
      expect(parsed.userId).toBeUndefined();
      expect(parsed.note).toBeUndefined();
    });
  });
});
