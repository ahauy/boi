import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import {
  generateAllSecrets,
  generateRandomSecret,
} from '../scripts/generate-secrets';
import {
  checkConnectivityAndReplicaSet,
  checkIndexesInSync,
  reconcileCreditLedger,
  checkOrphanedRecords,
  runDatabaseDiagnostics,
} from '../scripts/db-check';
import {
  UserSchema,
  CreditTransactionSchema,
  ReadingSchema,
  SessionSchema,
  ReferralSchema,
} from '../src/schemas';
import { CreditTransactionType, HandOrientation, ReadingSchool, ReadingStatus } from '@palmsight/shared';

describe('US-DEPLOY-01 & US-DEPLOY-02: Secrets & Database Diagnostics', () => {
  describe('US-DEPLOY-01: Secret Generator', () => {
    it('generates random hex string of requested byte length', () => {
      const secret = generateRandomSecret(64);
      expect(secret).toHaveLength(128); // 64 bytes in hex = 128 chars
      expect(/^[0-9a-f]{128}$/.test(secret)).toBe(true);
    });

    it('generates strong distinct secrets for all tokens', () => {
      const secrets = generateAllSecrets();
      const allValues = Object.values(secrets);
      const uniqueValues = new Set(allValues);

      expect(uniqueValues.size).toBe(allValues.length);
      for (const val of allValues) {
        expect(val).toHaveLength(128);
      }
    });
  });

  describe('US-DEPLOY-02: Database Diagnostics (db:check)', () => {
    let replSet: MongoMemoryReplSet;
    let conn: mongoose.Connection;
    let UserModel: mongoose.Model<any>;
    let TxModel: mongoose.Model<any>;
    let ReadingModel: mongoose.Model<any>;
    let SessionModel: mongoose.Model<any>;
    let ReferralModel: mongoose.Model<any>;

    beforeAll(async () => {
      replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
      });
      const uri = replSet.getUri();
      const mongooseInstance = await mongoose.connect(uri);
      conn = mongooseInstance.connection;

      UserModel = conn.models.User || conn.model('User', UserSchema);
      TxModel =
        conn.models.CreditTransaction ||
        conn.model('CreditTransaction', CreditTransactionSchema);
      ReadingModel = conn.models.Reading || conn.model('Reading', ReadingSchema);
      SessionModel = conn.models.Session || conn.model('Session', SessionSchema);
      ReferralModel = conn.models.Referral || conn.model('Referral', ReferralSchema);
    }, 60000);

    afterAll(async () => {
      if (conn) {
        await conn.close();
      }
      if (replSet) {
        await replSet.stop();
      }
    });

    it('checks connectivity and replica set status accurately', async () => {
      const result = await checkConnectivityAndReplicaSet(conn);
      expect(result.ok).toBe(true);
      expect(result.isReplicaSet).toBe(true);
      expect(result.hosts?.length).toBeGreaterThanOrEqual(1);
    });

    it('checks index synchronization across schemas', async () => {
      const indexResult = await checkIndexesInSync(conn);
      expect(Array.isArray(indexResult.results)).toBe(true);
      expect(indexResult.results.length).toBeGreaterThanOrEqual(8);
    });

    it('reconciles credit ledger when no users exist (clean slate)', async () => {
      const result = await reconcileCreditLedger(conn);
      expect(result.ok).toBe(true);
      expect(result.totalUsers).toBe(0);
      expect(result.mismatches).toHaveLength(0);
    });

    it('reconciles credit ledger and detects mismatches when present', async () => {
      const userId = new Types.ObjectId();
      await UserModel.create({
        _id: userId,
        displayName: 'Test User',
        referralCode: 'RECON001',
        creditBalance: 3,
        identities: [],
        referralBlocked: false,
      });

      // User has balance 3, but 0 transactions -> mismatch
      let check = await reconcileCreditLedger(conn);
      expect(check.ok).toBe(false);
      expect(check.mismatches).toHaveLength(1);
      expect(check.mismatches[0].userId).toBe(userId.toString());
      expect(check.mismatches[0].userBalance).toBe(3);
      expect(check.mismatches[0].ledgerSum).toBe(0);

      // Add matching transactions
      await TxModel.create({
        userId,
        amount: 3,
        type: CreditTransactionType.SIGNUP_BONUS,
        balanceAfter: 3,
      });

      check = await reconcileCreditLedger(conn);
      expect(check.ok).toBe(true);
      expect(check.mismatches).toHaveLength(0);
    });

    it('detects orphaned records correctly', async () => {
      const nonExistentUserId = new Types.ObjectId();

      // Clean check first
      let orphanCheck = await checkOrphanedRecords(conn);
      expect(orphanCheck.ok).toBe(true);

      // Create orphaned reading
      await ReadingModel.create({
        userId: nonExistentUserId,
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
        school: ReadingSchool.WESTERN,
        topics: ['heartLine'],
        hand: HandOrientation.LEFT,
        status: ReadingStatus.DONE,
        result: { summary: 'test' },
      });

      orphanCheck = await checkOrphanedRecords(conn);
      expect(orphanCheck.ok).toBe(false);
      expect(orphanCheck.orphanedReadings).toBe(1);

      // Clean up orphaned reading
      await ReadingModel.deleteMany({ userId: nonExistentUserId });
      orphanCheck = await checkOrphanedRecords(conn);
      expect(orphanCheck.ok).toBe(true);
    });

    it('runs end-to-end runDatabaseDiagnostics successfully', async () => {
      // Sync indexes first so index check passes
      for (const target of [UserModel, TxModel, ReadingModel, SessionModel, ReferralModel]) {
        await target.syncIndexes();
      }

      const success = await runDatabaseDiagnostics(replSet.getUri());
      expect(success).toBe(true);
    });
  });
});
