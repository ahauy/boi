import * as fs from 'fs';
import * as path from 'path';
import mongoose, { Model, Schema, Connection } from 'mongoose';
import {
  UserSchema,
  PendingRegistrationSchema,
  PasswordResetSchema,
  SessionSchema,
  ReferralSchema,
  ReadingSchema,
  CreditTransactionSchema,
  DeletedIdentitySchema,
  GuestTrialSchema,
} from '../src/schemas';

// Load .env file if available
function loadEnv(): void {
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

export interface SyncTarget {
  name: string;
  schema: Schema;
}

export const SYNC_TARGETS: SyncTarget[] = [
  { name: 'User', schema: UserSchema },
  { name: 'PendingRegistration', schema: PendingRegistrationSchema },
  { name: 'PasswordReset', schema: PasswordResetSchema },
  { name: 'Session', schema: SessionSchema },
  { name: 'Referral', schema: ReferralSchema },
  { name: 'Reading', schema: ReadingSchema },
  { name: 'CreditTransaction', schema: CreditTransactionSchema },
  { name: 'DeletedIdentity', schema: DeletedIdentitySchema },
  { name: 'GuestTrial', schema: GuestTrialSchema },
];

export async function syncGuestTrialIndexes(connection: Connection): Promise<void> {
  const db = connection.db;
  if (!db) return;

  const guestTrialsColl = db.collection('guest_trials');
  await guestTrialsColl.createIndex(
    { fingerprintHash: 1 },
    { unique: true, name: 'uniq_fingerprint_hash' },
  );
  await guestTrialsColl.createIndex(
    { guestTokenHash: 1 },
    { unique: true, name: 'uniq_guest_token_hash' },
  );
  await guestTrialsColl.createIndex(
    { ipHash: 1, createdAt: -1 },
    { name: 'idx_ip_hash_created_at' },
  );
  await guestTrialsColl.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_expires_at' },
  );
  await guestTrialsColl.createIndex(
    { isClaimed: 1 },
    { name: 'idx_is_claimed' },
  );

  const readingsColl = db.collection('readings');
  try {
    await readingsColl.dropIndex('userId_1_idempotencyKey_1');
  } catch {
    // Ignore if not found
  }

  await readingsColl.createIndex(
    { userId: 1, idempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: { userId: { $type: 'objectId' } },
      name: 'uniq_user_idempotency_partial',
    },
  );

  await readingsColl.createIndex(
    { guestTokenHash: 1 },
    { sparse: true, name: 'idx_guest_token_hash_sparse' },
  );

  await readingsColl.createIndex(
    { previewExpiresAt: 1 },
    {
      expireAfterSeconds: 0,
      partialFilterExpression: { previewExpiresAt: { $type: 'date' } },
      name: 'ttl_preview_expires_at',
    },
  );

  console.log('✓ Guest Trial and Readings indexes synchronized successfully.');
}

export async function syncDatabaseIndexes(mongoUri?: string): Promise<void> {
  loadEnv();

  const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/palmsight';
  console.log(`Connecting to MongoDB to sync indexes... (${uri.replace(/\/\/.*@/, '//***:***@')})`);

  const connection = await mongoose.connect(uri, {
    autoIndex: false, // Ensure we manually control indexing
  });

  try {
    console.log('--- Starting Index Synchronization ---');

    for (const target of SYNC_TARGETS) {
      const model: Model<unknown> =
        mongoose.models[target.name] || mongoose.model(target.name, target.schema);

      // Ensure collection exists before syncing indexes
      try {
        await model.createCollection();
      } catch (err: unknown) {
        // Collection might already exist, ignore NamespaceExists
        const msg = (err as Error).message;
        if (!msg.includes('already exists') && !(err as { code?: number }).code?.toString().includes('48')) {
          console.warn(`[${target.name}] Collection creation note:`, msg);
        }
      }

      console.log(`[${target.name}] Syncing indexes for collection "${model.collection.name}"...`);
      await model.syncIndexes();

      const existingIndexes = await model.collection.indexes();
      console.log(`✓ [${target.name}] Indexes synced successfully (${existingIndexes.length} active indexes):`);
      for (const idx of existingIndexes) {
        const keyDesc = Object.entries(idx.key)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        const flags = [
          idx.unique ? 'unique' : null,
          idx.sparse ? 'sparse' : null,
          idx.expireAfterSeconds !== undefined ? `TTL (${idx.expireAfterSeconds}s)` : null,
          idx.partialFilterExpression ? `partial: ${JSON.stringify(idx.partialFilterExpression)}` : null,
        ]
          .filter(Boolean)
          .join(', ');

        console.log(`    - ${idx.name}: { ${keyDesc} } ${flags ? `[${flags}]` : ''}`);
      }
    }

    // Apply JSON schema validator for 'users' collection (creditBalance minimum 0)
    try {
      if (connection.connection.db) {
        await connection.connection.db.command({
          collMod: 'users',
          validator: {
            $jsonSchema: {
              bsonType: 'object',
              properties: {
                creditBalance: {
                  bsonType: ['int', 'long', 'double'],
                  minimum: 0,
                  description: 'creditBalance must be a non-negative integer',
                },
              },
            },
          },
          validationLevel: 'moderate',
        });
        console.log('✓ Applied JSON schema validator on "users" collection (creditBalance >= 0)');
      }
    } catch (err: unknown) {
      console.warn('⚠️ Note on "users" collection JSON validator collMod:', (err as Error).message);
    }

    console.log('--- All 8 Collections & Indexes Synchronized Successfully! ---');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

// Execute CLI command if run directly
if (require.main === module || (process.argv[1] && process.argv[1].endsWith('sync-indexes.ts'))) {
  syncDatabaseIndexes()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error syncing indexes:', err);
      process.exit(1);
    });
}
