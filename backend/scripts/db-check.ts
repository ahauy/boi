import * as fs from 'fs';
import * as path from 'path';
import mongoose, { Connection, Model, Types } from 'mongoose';
import {
  UserSchema,
  PendingRegistrationSchema,
  PasswordResetSchema,
  SessionSchema,
  ReferralSchema,
  ReadingSchema,
  CreditTransactionSchema,
  DeletedIdentitySchema,
} from '../src/schemas';

export function loadEnv(): void {
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env'),
    path.resolve(__dirname, '../.env'),
  ];

  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      try {
        process.loadEnvFile(envPath);
        break;
      } catch {
        // Continue to next candidate
      }
    }
  }
}

export const CHECK_TARGETS = [
  { name: 'User', schema: UserSchema },
  { name: 'PendingRegistration', schema: PendingRegistrationSchema },
  { name: 'PasswordReset', schema: PasswordResetSchema },
  { name: 'Session', schema: SessionSchema },
  { name: 'Referral', schema: ReferralSchema },
  { name: 'Reading', schema: ReadingSchema },
  { name: 'CreditTransaction', schema: CreditTransactionSchema },
  { name: 'DeletedIdentity', schema: DeletedIdentitySchema },
];

export interface ConnectivityResult {
  ok: boolean;
  isReplicaSet: boolean;
  setName?: string;
  primary?: string;
  hosts?: string[];
  message: string;
}

export async function checkConnectivityAndReplicaSet(
  conn: Connection,
): Promise<ConnectivityResult> {
  if (!conn.db) {
    return { ok: false, isReplicaSet: false, message: 'Database handle not available' };
  }

  const pingRes = await conn.db.admin().ping();
  if (!pingRes.ok) {
    return { ok: false, isReplicaSet: false, message: 'Admin ping failed' };
  }

  const hello = await conn.db.admin().command({ hello: 1 });
  const isReplicaSet = Boolean(hello.setName);

  return {
    ok: true,
    isReplicaSet,
    setName: hello.setName,
    primary: hello.primary,
    hosts: hello.hosts,
    message: isReplicaSet
      ? `Replica set active ("${hello.setName}") with ${hello.hosts?.length || 1} node(s)`
      : 'Standalone MongoDB instance (not a replica set)',
  };
}

export interface IndexSyncResult {
  ok: boolean;
  collection: string;
  totalIndexes: number;
  missingIndexes: string[];
  extraneousIndexes: string[];
}

export async function checkIndexesInSync(
  conn: Connection,
): Promise<{ ok: boolean; results: IndexSyncResult[] }> {
  const results: IndexSyncResult[] = [];
  let allOk = true;

  for (const target of CHECK_TARGETS) {
    const model: Model<unknown> =
      conn.models[target.name] || conn.model(target.name, target.schema);

    try {
      const diff = (await model.diffIndexes()) as { toDrop?: string[]; toCreate?: string[] } | null;
      const toDrop = diff?.toDrop || [];
      const toCreate = diff?.toCreate || [];
      const existingIndexes = await model.collection.indexes().catch(() => []);
      const isSync = toDrop.length === 0 && toCreate.length === 0;

      if (!isSync) {
        allOk = false;
      }

      results.push({
        ok: isSync,
        collection: model.collection.name,
        totalIndexes: existingIndexes.length,
        missingIndexes: toCreate,
        extraneousIndexes: toDrop,
      });
    } catch {
      // Collection might not exist yet
      results.push({
        ok: true,
        collection: model.collection.name,
        totalIndexes: 0,
        missingIndexes: [],
        extraneousIndexes: [],
      });
    }
  }

  return { ok: allOk, results };
}

export interface LedgerMismatch {
  userId: string;
  userBalance: number;
  ledgerSum: number;
}

export interface CreditLedgerResult {
  ok: boolean;
  totalUsers: number;
  totalTransactions: number;
  mismatches: LedgerMismatch[];
}

export async function reconcileCreditLedger(
  conn: Connection,
): Promise<CreditLedgerResult> {
  const userModel = conn.models.User || conn.model('User', UserSchema);
  const txModel =
    conn.models.CreditTransaction ||
    conn.model('CreditTransaction', CreditTransactionSchema);

  const totalUsers = await userModel.countDocuments();
  const totalTransactions = await txModel.countDocuments();

  if (totalUsers === 0) {
    return { ok: true, totalUsers: 0, totalTransactions, mismatches: [] };
  }

  const txSums = await txModel.aggregate([
    { $group: { _id: '$userId', total: { $sum: '$amount' } } },
  ]);

  const sumMap = new Map<string, number>();
  for (const item of txSums) {
    sumMap.set(item._id.toString(), item.total);
  }

  const users = await userModel
    .find({}, { _id: 1, creditBalance: 1 })
    .lean<Array<{ _id: Types.ObjectId; creditBalance?: number }>>();
  const mismatches: LedgerMismatch[] = [];

  for (const user of users) {
    const uid = user._id.toString();
    const expected = sumMap.get(uid) || 0;
    const actual = user.creditBalance ?? 0;

    if (actual !== expected) {
      mismatches.push({
        userId: uid,
        userBalance: actual,
        ledgerSum: expected,
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    totalUsers,
    totalTransactions,
    mismatches,
  };
}

export interface OrphanedRecordsResult {
  ok: boolean;
  orphanedReadings: number;
  orphanedSessions: number;
  orphanedTransactions: number;
  orphanedReferrals: number;
}

export async function checkOrphanedRecords(
  conn: Connection,
): Promise<OrphanedRecordsResult> {
  const readingModel = conn.models.Reading || conn.model('Reading', ReadingSchema);
  const sessionModel = conn.models.Session || conn.model('Session', SessionSchema);
  const txModel =
    conn.models.CreditTransaction ||
    conn.model('CreditTransaction', CreditTransactionSchema);
  const referralModel =
    conn.models.Referral || conn.model('Referral', ReferralSchema);

  const [orphanedReadings, orphanedSessions, orphanedTransactions, orphanedReferrals] =
    await Promise.all([
      countOrphans(readingModel, 'userId'),
      countOrphans(sessionModel, 'userId'),
      countOrphans(txModel, 'userId'),
      countReferralOrphans(referralModel),
    ]);

  const ok =
    orphanedReadings === 0 &&
    orphanedSessions === 0 &&
    orphanedTransactions === 0 &&
    orphanedReferrals === 0;

  return {
    ok,
    orphanedReadings,
    orphanedSessions,
    orphanedTransactions,
    orphanedReferrals,
  };
}

async function countOrphans(model: Model<unknown>, foreignKey: string): Promise<number> {
  const orphans = await model.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: foreignKey,
        foreignField: '_id',
        as: 'user',
      },
    },
    { $match: { user: { $size: 0 } } },
    { $count: 'total' },
  ]);

  return orphans[0]?.total || 0;
}

async function countReferralOrphans(referralModel: Model<unknown>): Promise<number> {
  const orphans = await referralModel.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'referrerId',
        foreignField: '_id',
        as: 'referrer',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'refereeId',
        foreignField: '_id',
        as: 'referee',
      },
    },
    {
      $match: {
        $or: [{ referrer: { $size: 0 } }, { referee: { $size: 0 } }],
      },
    },
    { $count: 'total' },
  ]);

  return orphans[0]?.total || 0;
}


function logIndexResults(indexInfo: { ok: boolean; results: IndexSyncResult[] }): void {
  console.log('\n[2] Index Synchronization Check:');
  for (const r of indexInfo.results) {
    const statusMark = r.ok ? '✓' : '⚠️';
    console.log(`    ${statusMark} [${r.collection}] ${r.totalIndexes} active indexes`);
    if (!r.ok) {
      if (r.missingIndexes.length) console.log(`       Missing: ${r.missingIndexes.join(', ')}`);
      if (r.extraneousIndexes.length) console.log(`       Extraneous: ${r.extraneousIndexes.join(', ')}`);
    }
  }
}

function logLedgerResults(ledgerInfo: CreditLedgerResult): void {
  console.log('\n[3] Credit Ledger Reconciliation:');
  if (ledgerInfo.totalUsers === 0) {
    console.log('    ✓ No users exist in database yet (clean slate)');
  } else if (ledgerInfo.ok) {
    console.log(`    ✓ All ${ledgerInfo.totalUsers} users match transaction history (${ledgerInfo.totalTransactions} transactions checked)`);
  } else {
    console.log(`    ❌ Found ${ledgerInfo.mismatches.length} balance discrepancies!`);
    for (const m of ledgerInfo.mismatches) {
      console.log(`       User ${m.userId}: user.creditBalance=${m.userBalance}, ledgerSum=${m.ledgerSum}`);
    }
  }
}

function logOrphanResults(orphanInfo: OrphanedRecordsResult): void {
  console.log('\n[4] Orphaned Records Check:');
  if (orphanInfo.ok) {
    console.log('    ✓ Zero orphaned records detected across all collections');
  } else {
    if (orphanInfo.orphanedReadings) console.log(`    ❌ Orphaned readings: ${orphanInfo.orphanedReadings}`);
    if (orphanInfo.orphanedSessions) console.log(`    ❌ Orphaned sessions: ${orphanInfo.orphanedSessions}`);
    if (orphanInfo.orphanedTransactions) console.log(`    ❌ Orphaned transactions: ${orphanInfo.orphanedTransactions}`);
    if (orphanInfo.orphanedReferrals) console.log(`    ❌ Orphaned referrals: ${orphanInfo.orphanedReferrals}`);
  }
}

export async function runDatabaseDiagnostics(mongoUri?: string): Promise<boolean> {
  loadEnv();
  const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/palmsight';
  console.log('================================================================');
  console.log('  PalmSight Cloud Database Diagnostic & Health Check (US-DEPLOY-02)');
  console.log('================================================================');
  console.log(`Connecting to: ${uri.replace(/\/\/.*@/, '//***:***@')}\n`);

  const connection = await mongoose.connect(uri, { autoIndex: false });
  try {
    const connInfo = await checkConnectivityAndReplicaSet(connection.connection);
    console.log(`[1] Connectivity: ${connInfo.ok ? '✓ CONNECTED' : '❌ FAILED'}\n    Status: ${connInfo.message}`);
    if (connInfo.hosts?.length) console.log(`    Members: ${connInfo.hosts.join(', ')}`);

    const indexInfo = await checkIndexesInSync(connection.connection);
    logIndexResults(indexInfo);

    const ledgerInfo = await reconcileCreditLedger(connection.connection);
    logLedgerResults(ledgerInfo);

    const orphanInfo = await checkOrphanedRecords(connection.connection);
    logOrphanResults(orphanInfo);

    const overallSuccess = connInfo.ok && indexInfo.ok && ledgerInfo.ok && orphanInfo.ok;
    console.log('\n================================================================');
    console.log(overallSuccess ? '  Result: SUCCESS — Database is healthy and production-ready! ✓' : '  Result: ANOMALY DETECTED — Please review issues above! ❌');
    console.log('================================================================\n');
    return overallSuccess;
  } finally {
    await mongoose.disconnect();
  }
}

if (
  require.main === module ||
  (process.argv[1] && process.argv[1].endsWith('db-check.ts'))
) {
  runDatabaseDiagnostics()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ Diagnostic error:', err);
      process.exit(1);
    });
}
