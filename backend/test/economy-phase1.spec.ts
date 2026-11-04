import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as crypto from 'crypto';
import { Types } from 'mongoose';
import {
  CreditTransactionType,
  ECONOMY_DEFAULTS,
  AppConfigResponseDto,
  MeResponseDto,
} from '@palmsight/shared';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { CreditLedgerService } from '../src/credits/credit-ledger.service';
import { AuthService } from '../src/auth/auth.service';
import { reconcileCreditLedger } from '../scripts/db-check';
import type { GoogleProfile } from '../src/auth/google-auth.verifier';

const googleProfile: GoogleProfile = {
  sub: 'google-sub-economy-p1',
  email: 'economy.user@example.com',
  emailVerified: true,
  name: 'Economy Phase 1 User',
  picture: null,
};

describe('Phase 1: Server Economy (Playbook §1.1, §2.2, §7.1, §10, §12)', () => {
  let testApp: TestAppInstance;
  let creditLedgerService: CreditLedgerService;
  let accessToken: string;
  let userId: Types.ObjectId;

  const createDeviceSession = (
    deviceId: string,
    ip = '10.0.0.1',
  ) =>
    fetch(`${testApp.baseUrl}/api/v1/auth/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client': 'native',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ deviceId }),
    });

  beforeAll(async () => {
    testApp = await createTestApp({
      googleVerifier: { verify: async () => googleProfile },
      starterGrant: 5,
      pricePerAction: 5,
      starterNetworkDailyCap: 5,
      anonymousSignupDailyCap: 20,
    });
    creditLedgerService = testApp.app.get(CreditLedgerService);

    // Create a base user for testing
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'any' }),
    });
    const body = (await res.json()) as any;
    accessToken = body.accessToken;
    userId = new Types.ObjectId(body.user.id);
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  describe('1. Atomic credit() and debit() & Ledger Sum Invariance', () => {
    it('executes atomic credit and debit operations, keeping balance equal to ledger sum', async () => {
      const session = await testApp.connection.startSession();
      try {
        // Initial state check
        let user = await testApp.connection.collection('users').findOne({ _id: userId });
        const initialBalance = user?.creditBalance ?? 0;

        // Perform a credit operation
        session.startTransaction();
        const creditTx = await creditLedgerService.credit(
          {
            userId,
            amount: 20,
            type: CreditTransactionType.ADMIN_ADJUST,
            reason: 'operator',
            note: 'Manual test grant',
          },
          session,
        );
        await session.commitTransaction();

        expect(creditTx.amount).toBe(20);
        expect(creditTx.balanceAfter).toBe(initialBalance + 20);
        expect(creditTx.reason).toBe('operator');

        // Perform a debit operation
        session.startTransaction();
        const debitTx = await creditLedgerService.debit(
          {
            userId,
            amount: 10,
            type: CreditTransactionType.SINGLE,
            reason: 'single',
          },
          session,
        );
        await session.commitTransaction();

        expect(debitTx.amount).toBe(-10);
        expect(debitTx.balanceAfter).toBe(initialBalance + 10);
        expect(debitTx.reason).toBe('single');
      } finally {
        await session.endSession();
      }

      // Reconcile credit ledger: sum of all transactions must exactly equal user.creditBalance
      const reconciliation = await reconcileCreditLedger(testApp.connection);
      expect(reconciliation.ok).toBe(true);
      expect(reconciliation.mismatches).toHaveLength(0);
    });

    it('rejects credit and debit with non-positive or non-integer amounts', async () => {
      const session = await testApp.connection.startSession();
      try {
        session.startTransaction();
        await expect(
          creditLedgerService.credit(
            { userId, amount: 0, type: CreditTransactionType.ADMIN_ADJUST },
            session,
          ),
        ).rejects.toThrow();

        await expect(
          creditLedgerService.credit(
            { userId, amount: -5, type: CreditTransactionType.ADMIN_ADJUST },
            session,
          ),
        ).rejects.toThrow();

        await expect(
          creditLedgerService.credit(
            { userId, amount: 3.5, type: CreditTransactionType.ADMIN_ADJUST },
            session,
          ),
        ).rejects.toThrow();

        await expect(
          creditLedgerService.debit(
            { userId, amount: 0, type: CreditTransactionType.SINGLE },
            session,
          ),
        ).rejects.toThrow();

        await expect(
          creditLedgerService.debit(
            { userId, amount: -10, type: CreditTransactionType.SINGLE },
            session,
          ),
        ).rejects.toThrow();

        await expect(
          creditLedgerService.debit(
            { userId, amount: 2.5, type: CreditTransactionType.SINGLE },
            session,
          ),
        ).rejects.toThrow();
        await session.abortTransaction();
      } finally {
        await session.endSession();
      }
    });
  });

  describe('2. Concurrent debits never go negative', () => {
    it('allows only 2 successful debits from 10 parallel requests when balance is 10 (cost=5)', async () => {
      // Create dedicated user with balance = 10
      const testUserId = new Types.ObjectId();
      await testApp.connection.collection('users').insertOne({
        _id: testUserId,
        displayName: 'Concurrency Tester',
        creditBalance: 10,
        referralCode: 'CONCUR01',
        identities: [],
        referralBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await testApp.connection.collection('credit_transactions').insertOne({
        userId: testUserId,
        amount: 10,
        type: CreditTransactionType.STARTER,
        reason: 'starter',
        balanceAfter: 10,
        createdAt: new Date(),
      });

      // Fire 10 parallel debits of 5 credits each
      const results = await Promise.allSettled(
        Array.from({ length: 10 }).map(async () => {
          const readingId = new Types.ObjectId();
          return creditLedgerService.spendForReading(
            testUserId,
            readingId,
            undefined,
            1, // 1 action = 5 credits
          );
        }),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 2 succeeded (2 * 5 = 10) and 8 rejected
      expect(fulfilled).toHaveLength(2);
      expect(rejected).toHaveLength(8);

      for (const rej of rejected) {
        const error = (rej as PromiseRejectedResult).reason;
        expect(error.getStatus ? error.getStatus() : error.status).toBe(402);
      }

      // Final balance must be non-negative and equal 0
      const finalUser = await testApp.connection
        .collection('users')
        .findOne({ _id: testUserId });
      expect(finalUser?.creditBalance).toBe(0);

      // Ledger sum must match balance
      const txs = await testApp.connection
        .collection('credit_transactions')
        .find({ userId: testUserId })
        .toArray();
      const sum = txs.reduce((acc, t) => acc + t.amount, 0);
      expect(sum).toBe(0);
      expect(finalUser?.creditBalance).toBe(sum);
    });
  });

  describe('3. Batch Action Pricing & Exact Once-Only Refund', () => {
    it('charges actionCount * pricePerAction, enforces batch limit <= 5, and refunds exact amount charged once', async () => {
      // Top up user balance
      const session = await testApp.connection.startSession();
      try {
        session.startTransaction();
        await creditLedgerService.credit(
          {
            userId,
            amount: 50,
            type: CreditTransactionType.ADMIN_ADJUST,
            reason: 'operator',
          },
          session,
        );
        await session.commitTransaction();
      } finally {
        await session.endSession();
      }

      const readingId = new Types.ObjectId();

      // Test batch limit <= 5
      const invalidBatchSession = await testApp.connection.startSession();
      invalidBatchSession.startTransaction();
      try {
        await expect(
          creditLedgerService.spendForReading(
            userId,
            readingId,
            invalidBatchSession,
            6, // Exceeds MAX_ACTIONS_PER_TAP (5)
          ),
        ).rejects.toThrow();

        await expect(
          creditLedgerService.spendForReading(
            userId,
            readingId,
            invalidBatchSession,
            0,
          ),
        ).rejects.toThrow();
        await invalidBatchSession.abortTransaction();
      } finally {
        await invalidBatchSession.endSession();
      }

      // Valid batch spend: count = 3 -> 3 * 5 = 15 credits
      const userBefore = await testApp.connection
        .collection('users')
        .findOne({ _id: userId });
      const balanceBefore = userBefore!.creditBalance;

      const spendSession = await testApp.connection.startSession();
      spendSession.startTransaction();
      try {
        const spendTx = await creditLedgerService.spendForReading(
          userId,
          readingId,
          spendSession,
          3,
        );
        await spendSession.commitTransaction();

        expect(spendTx.amount).toBe(-15);
        expect(spendTx.balanceAfter).toBe(balanceBefore - 15);
        expect(spendTx.reason).toBe('single');
      } finally {
        await spendSession.endSession();
      }

      // Refund the reading: must refund exact 15 credits
      const refundSession = await testApp.connection.startSession();
      refundSession.startTransaction();
      try {
        const refundTx = await creditLedgerService.refundReading(
          userId,
          readingId,
          refundSession,
        );
        await refundSession.commitTransaction();

        expect(refundTx.amount).toBe(15);
        expect(refundTx.balanceAfter).toBe(balanceBefore);
        expect(refundTx.reason).toBe('refund');
      } finally {
        await refundSession.endSession();
      }

      // Second refund for same readingId must be rejected (cannot refund twice)
      const secondRefundSession = await testApp.connection.startSession();
      secondRefundSession.startTransaction();
      try {
        await expect(
          creditLedgerService.refundReading(
            userId,
            readingId,
            secondRefundSession,
          ),
        ).rejects.toThrow();
        await secondRefundSession.abortTransaction();
      } finally {
        await secondRefundSession.endSession();
      }
    });
  });

  describe('4. Starter Grant Rules (Per Account, Per Device, Network Daily Cap)', () => {
    it('grants STARTER_GRANT (5) on first anonymous account / device', async () => {
      const devId = crypto.randomUUID();
      const res = await createDeviceSession(devId, '192.168.1.10');
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.isNewUser).toBe(true);
      expect(body.user.creditBalance).toBe(5);

      // Verify device record created in devices collection
      const device = await testApp.connection
        .collection('devices')
        .findOne({ deviceIdHash: { $exists: true } });
      expect(device).toBeDefined();
      expect(device?.starterGrantedAt).toBeDefined();
    });

    it('refuses starter grant (balance=0) for a second account on an already-granted device', async () => {
      const devId = crypto.randomUUID();
      const deviceIdHash = crypto
        .createHmac('sha256', 'test-identity-secret-at-least-32-chars-long')
        .update(`device:${devId}`)
        .digest('hex');

      await testApp.connection.collection('devices').insertOne({
        deviceIdHash,
        starterGrantedAt: new Date(),
        starterUserId: new Types.ObjectId(),
        starterIpHash: 'some-ip-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const session = await testApp.connection.startSession();
      try {
        session.startTransaction();
        const authService = testApp.app.get(AuthService);
        const secondUser = await (authService as any).createUserWithBonus(
          {
            displayName: 'Second User On Same Device',
            email: 'second.device@example.com',
            deviceIdHash,
          },
          false,
          session,
        );
        await session.commitTransaction();

        expect(secondUser.creditBalance).toBe(0);
        expect(secondUser.starterGrantedAt).toBeNull();
      } finally {
        await session.endSession();
      }
    });

    it('refuses starter grant once the 24h network IP cap is reached (<= 5 per IP / 24h)', async () => {
      const sharedIp = '198.51.100.99';

      // Create 5 accounts from the same IP (all 5 should get starter grant 5)
      for (let i = 0; i < 5; i++) {
        const res = await createDeviceSession(crypto.randomUUID(), sharedIp);
        expect(res.status).toBe(200);
        const data = (await res.json()) as any;
        expect(data.user.creditBalance).toBe(5);
      }

      // The 6th account from the same IP within 24h gets 0 starter grant (network cap enforced)
      const sixthRes = await createDeviceSession(crypto.randomUUID(), sharedIp);
      expect(sixthRes.status).toBe(200);
      const sixthData = (await sixthRes.json()) as any;
      expect(sixthData.user.creditBalance).toBe(0);
    });
  });

  describe('5. GET /api/v1/me and GET /api/v1/config Endpoints', () => {
    it('GET /api/v1/me returns balance, vip object, billingRef, and grantedNow', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/v1/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);

      const me = (await res.json()) as MeResponseDto;
      expect(me).toHaveProperty('balance');
      expect(me.balance).toBe(me.creditBalance);
      expect(me).toHaveProperty('vip');
      expect(me.vip).toEqual({
        active: false,
        productId: null,
        expiresAt: null,
        willRenew: false,
      });
      expect(me).toHaveProperty('billingRef');
      expect(typeof me.billingRef).toBe('string');
      expect(me.billingRef).toHaveLength(64); // SHA-256 HMAC hex
      expect(me).toHaveProperty('grantedNow', false);
    });

    it('GET /api/v1/me calculates active VIP when vipExpiresAt is in the future', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await testApp.connection.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            vipExpiresAt: futureDate,
            vipProductId: 'weeklyid',
            vipWillRenew: true,
          },
        },
      );

      const res = await fetch(`${testApp.baseUrl}/api/v1/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);

      const me = (await res.json()) as MeResponseDto;
      expect(me.vip).toEqual({
        active: true,
        productId: 'weeklyid',
        expiresAt: futureDate.toISOString(),
        willRenew: true,
      });
    });

    it('GET /api/v1/config returns public economy config without authentication', async () => {
      const res = await fetch(`${testApp.baseUrl}/api/v1/config`);
      expect(res.status).toBe(200);

      const config = (await res.json()) as AppConfigResponseDto;
      expect(config.currency).toBe(ECONOMY_DEFAULTS.CURRENCY);
      expect(config.pricePerAction).toBe(5);
      expect(config.maxActionsPerTap).toBe(5);
      expect(config.starterGrant).toBe(5);
      expect(config.rewardTz).toBe(ECONOMY_DEFAULTS.REWARD_TZ);
      expect(config.checkinLadder).toEqual(ECONOMY_DEFAULTS.CHECKIN_LADDER);
      expect(config.streakLength).toBe(365);
      expect(config.milestones).toEqual(ECONOMY_DEFAULTS.MILESTONES);
      expect(config.restoreCostPerDay).toBe(10);
      expect(config.restoreMaxMissed).toBe(3);
      expect(config.wheelPrizes).toEqual(ECONOMY_DEFAULTS.WHEEL_PRIZES);
      expect(config.freeSpins).toBe(1);
      expect(config.adSpins).toBe(3);
      expect(config.gemSpinCost).toBe(3);
      expect(config.checkinDoubleCap).toBe(1);
      expect(config.bonusAdAmount).toBe(3);
      expect(config.bonusAdCap).toBe(5);
      expect(config.vipDaily).toBe(50);
      expect(config.minAdWatchSeconds).toBe(15);
      expect(config.legalUrls).toHaveProperty('privacyUrl');
      expect(config.legalUrls).toHaveProperty('termsUrl');
    });
  });
});
