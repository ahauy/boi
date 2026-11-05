import mongoose, { Connection } from 'mongoose';
import { ReadingSchema, GuestTrialSchema } from '../src/schemas';
import { CloudinaryService } from '../src/readings/cloudinary.service';
import { loadEnv } from './db-check';

export { loadEnv };

export interface PurgeExpiredGuestReadingsOptions {
  limit?: number;
  dryRun?: boolean;
}

export interface PurgeExpiredGuestReadingsResult {
  ok: boolean;
  processed: number;
  imagesDeleted: number;
  failedImages: string[];
}

export async function purgeExpiredGuestReadings(
  conn: Connection,
  cloudinary: CloudinaryService = new CloudinaryService(),
  options: PurgeExpiredGuestReadingsOptions = {},
): Promise<PurgeExpiredGuestReadingsResult> {
  const limit = options.limit ?? 100;
  const readingModel = conn.models.Reading || conn.model('Reading', ReadingSchema);
  const guestTrialModel = conn.models.GuestTrial || conn.model('GuestTrial', GuestTrialSchema);

  const now = new Date();
  const expiredDocs = await readingModel
    .find({
      userId: null,
      previewExpiresAt: { $lte: now, $ne: null },
    })
    .limit(limit)
    .lean();

  let processed = 0;
  let imagesDeleted = 0;
  const failedImages: string[] = [];

  for (const doc of expiredDocs) {
    const publicIds: string[] = [];
    if (doc.imagePublicId && !doc.imagePublicId.startsWith('local:')) {
      publicIds.push(doc.imagePublicId);
    }
    if (doc.annotatedImagePublicId && !doc.annotatedImagePublicId.startsWith('local:')) {
      publicIds.push(doc.annotatedImagePublicId);
    }

    if (options.dryRun) {
      processed++;
      imagesDeleted += publicIds.length;
      continue;
    }

    let allDeleted = true;
    for (const pid of publicIds) {
      const ok = await cloudinary.deleteImage(pid);
      if (ok) {
        imagesDeleted++;
      } else {
        allDeleted = false;
        failedImages.push(pid);
      }
    }

    if (allDeleted) {
      await guestTrialModel.deleteMany({ readingId: doc._id });
      await readingModel.deleteOne({ _id: doc._id });
      processed++;
    }
  }

  return {
    ok: failedImages.length === 0,
    processed,
    imagesDeleted,
    failedImages,
  };
}

export function parseArgs(args: string[]): PurgeExpiredGuestReadingsOptions {
  let limit: number | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--limit' || arg === '-l') {
      limit = parseInt(args[++i], 10);
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.slice('--limit='.length), 10);
    }
  }

  return { limit, dryRun };
}

export async function runPurgeExpiredGuestReadingsCli(): Promise<void> {
  loadEnv();
  const options = parseArgs(process.argv.slice(2));

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/palmsight';
  console.log('================================================================');
  console.log('  PalmSight Purge Expired Guest Readings & Cloudinary Images');
  console.log('================================================================');
  console.log(`Connecting to: ${uri.replace(/\/\/.*@/, '//***:***@')}\n`);
  if (options.dryRun) console.log('Mode: DRY-RUN (no deletions)');
  if (options.limit) console.log(`Limit: ${options.limit}`);

  const connection = await mongoose.connect(uri, { autoIndex: false });
  try {
    const result = await purgeExpiredGuestReadings(
      connection.connection,
      new CloudinaryService(),
      options,
    );
    console.log(`\n✓ Result: ${result.ok ? 'SUCCESS' : 'PARTIAL / WARNING'}`);
    console.log(`  Readings processed: ${result.processed}`);
    console.log(`  Images deleted: ${result.imagesDeleted}`);
    if (result.failedImages.length > 0) {
      console.warn(`  Failed image publicIds: ${result.failedImages.join(', ')}`);
    }
    console.log('================================================================\n');
  } catch (err: unknown) {
    console.error('\n❌ FAILED to purge expired guest readings:');
    console.error((err as Error).message || err);
    console.log('================================================================\n');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (
  require.main === module ||
  (process.argv[1] && process.argv[1].endsWith('purge-expired-guest-readings.ts'))
) {
  runPurgeExpiredGuestReadingsCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Unexpected CLI error:', err);
      process.exit(1);
    });
}
