import mongoose from 'mongoose';
import { deleteUserAccount } from '../src/users/account-deletion';
import { loadEnv } from './db-check';

export { loadEnv, deleteUserAccount };
export type { DeleteUserAccountResult } from '../src/users/account-deletion';

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
    if (!result.ok) {
      console.error(`\n❌ NOT DELETED: ${result.message}`);
      if (result.unremovedImages && result.unremovedImages.length > 0) {
        console.error(`  Unremoved images on Cloudinary: ${result.unremovedImages.join(', ')}`);
      }
      console.log('================================================================\n');
      process.exitCode = 1;
    } else {
      console.log(`\n✓ SUCCESS: ${result.message}`);
      console.log(`  Identities recorded to deleted_identities: ${result.identitiesRecorded}`);
      console.log('================================================================\n');
    }
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
