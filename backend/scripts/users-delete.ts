import * as crypto from 'crypto';
import mongoose, { Connection, Types } from 'mongoose';
import { DeletedIdentityKind } from '@palmsight/shared';
import {
  UserSchema,
  DeletedIdentitySchema,
  SessionSchema,
  PasswordResetSchema,
  ReadingSchema,
} from '../src/schemas';
import { CloudinaryService } from '../src/readings/cloudinary.service';
import { loadEnv } from './db-check';

export { loadEnv };

export interface DeleteUserAccountResult {
  ok: boolean;
  message: string;
  identitiesRecorded: number;
}

export async function deleteUserAccount(
  conn: Connection,
  userId: string | Types.ObjectId,
  note?: string,
  identitySecret?: string,
): Promise<DeleteUserAccountResult> {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new Error(`Invalid user ID: ${userId}`);
  }

  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const userModel = conn.models.User || conn.model('User', UserSchema);
  const deletedIdentityModel =
    conn.models.DeletedIdentity || conn.model('DeletedIdentity', DeletedIdentitySchema);
  const sessionModel = conn.models.Session || conn.model('Session', SessionSchema);
  const passwordResetModel =
    conn.models.PasswordReset || conn.model('PasswordReset', PasswordResetSchema);
  const readingModel = conn.models.Reading || conn.model('Reading', ReadingSchema);

  const secret =
    identitySecret || process.env.IDENTITY_HASH_SECRET || 'palmsight-identity-secret';

  const userReadings = await readingModel
    .find({ userId: userObjectId })
    .select('imagePublicId annotatedImagePublicId')
    .lean();

  const session = await conn.startSession();
  session.startTransaction();

  try {
    const user = await userModel
      .findOne({ _id: userObjectId, deletedAt: null })
      .session(session);

    if (!user) {
      throw new Error(`User not found or already deleted: ${userId}`);
    }

    const identitiesToRecord: Array<{ kind: DeletedIdentityKind; input: string }> = [];

    if (user.email) {
      identitiesToRecord.push({
        kind: DeletedIdentityKind.EMAIL,
        input: user.email.toLowerCase(),
      });
    }

    if (Array.isArray(user.identities)) {
      for (const id of user.identities) {
        if (id.provider && id.providerUserId) {
          identitiesToRecord.push({
            kind: id.provider as unknown as DeletedIdentityKind,
            input: `${id.provider}:${id.providerUserId}`,
          });
        }
        if (
          id.email &&
          (!user.email || id.email.toLowerCase() !== user.email.toLowerCase())
        ) {
          identitiesToRecord.push({
            kind: DeletedIdentityKind.EMAIL,
            input: id.email.toLowerCase(),
          });
        }
      }
    }

    const uniqueIdentities = new Map<
      string,
      { kind: DeletedIdentityKind; valueHmac: string }
    >();

    for (const item of identitiesToRecord) {
      const valueHmac = crypto
        .createHmac('sha256', secret)
        .update(item.input)
        .digest('hex');

      if (!uniqueIdentities.has(valueHmac)) {
        uniqueIdentities.set(valueHmac, { kind: item.kind, valueHmac });
      }
    }

    const now = new Date();
    let identitiesRecorded = 0;

    for (const item of uniqueIdentities.values()) {
      try {
        await deletedIdentityModel.updateOne(
          { valueHmac: item.valueHmac },
          {
            $setOnInsert: {
              kind: item.kind,
              valueHmac: item.valueHmac,
              deletedAt: now,
            },
          },
          { upsert: true, session },
        );
        identitiesRecorded++;
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        if (error.code === 11000 || error.message?.includes('E11000')) {
          identitiesRecorded++;
        } else {
          throw err;
        }
      }
    }

    await sessionModel.deleteMany({ userId: userObjectId }, { session });

    await passwordResetModel.deleteMany({ userId: userObjectId }, { session });

    await readingModel.updateMany(
      { userId: userObjectId },
      {
        $set: {
          result: null,
          imageUrl: null,
          annotatedImageUrl: null,
          imagePublicId: null,
          annotatedImagePublicId: null,
          palmLines: null,
          deletedAt: now,
        },
      },
      { session },
    );

    await userModel.updateOne(
      { _id: userObjectId },
      {
        $set: {
          displayName: 'Người dùng đã xoá',
          username: null,
          email: null,
          passwordHash: null,
          passwordUpdatedAt: null,
          avatarUrl: null,
          identities: [],
          deletedAt: now,
        },
      },
      { session },
    );

    await session.commitTransaction();

    const cloudinary = new CloudinaryService();
    if (cloudinary.isConfigured() && userReadings.length > 0) {
      await Promise.all(
        userReadings.flatMap((doc: any) => [
          cloudinary.deleteImage(doc.imagePublicId),
          cloudinary.deleteImage(doc.annotatedImagePublicId),
        ]),
      );
    }

    return {
      ok: true,
      message: `Account for user ${userId} deleted successfully.${note ? ` Note: ${note}` : ''}`,
      identitiesRecorded,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

export function parseArgs(args: string[]): { userId?: string; note?: string } {
  let userId: string | undefined;
  let note: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--user' || arg === '-u') {
      userId = args[++i];
    } else if (arg.startsWith('--user=')) {
      userId = arg.slice('--user='.length);
    } else if (arg.startsWith('-u=')) {
      userId = arg.slice('-u='.length);
    } else if (arg === '--note' || arg === '-n') {
      note = args[++i];
    } else if (arg.startsWith('--note=')) {
      note = arg.slice('--note='.length);
    } else if (arg.startsWith('-n=')) {
      note = arg.slice('-n='.length);
    }
  }

  return { userId, note };
}

export async function runUsersDeleteCli(): Promise<void> {
  loadEnv();
  const args = process.argv.slice(2);
  const { userId, note } = parseArgs(args);

  if (!userId) {
    console.error('❌ Error: Missing required --user / -u argument.');
    console.error('Usage: pnpm --filter backend users:delete --user <id> [--note "<link yêu cầu>"]');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/palmsight';
  console.log('================================================================');
  console.log('  PalmSight Manual Account Deletion (US-ACCT-001)');
  console.log('================================================================');
  console.log(`Connecting to: ${uri.replace(/\/\/.*@/, '//***:***@')}\n`);
  console.log(`Target User ID: ${userId}`);
  if (note) console.log(`Note: ${note}`);

  const connection = await mongoose.connect(uri, { autoIndex: false });
  try {
    const result = await deleteUserAccount(connection.connection, userId, note);
    console.log(`\n✓ SUCCESS: ${result.message}`);
    console.log(`  Identities recorded to deleted_identities: ${result.identitiesRecorded}`);
    console.log('================================================================\n');
  } catch (err: unknown) {
    console.error('\n❌ FAILED to delete user account:');
    console.error((err as Error).message || err);
    console.log('================================================================\n');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (
  require.main === module ||
  (process.argv[1] && process.argv[1].endsWith('users-delete.ts'))
) {
  runUsersDeleteCli()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Unexpected CLI error:', err);
      process.exit(1);
    });
}
