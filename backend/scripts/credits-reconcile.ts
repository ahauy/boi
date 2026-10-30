import mongoose from 'mongoose';
import {
  reconcileCreditLedger,
  CreditLedgerResult,
  loadEnv,
} from './db-check';

export { reconcileCreditLedger, CreditLedgerResult };

export async function runCreditsReconciliation(mongoUri?: string): Promise<boolean> {
  loadEnv();
  const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/palmsight';
  console.log('================================================================');
  console.log('  PalmSight Credit Ledger Reconciliation (US-ACCT-001)');
  console.log('================================================================');
  console.log(`Connecting to: ${uri.replace(/\/\/.*@/, '//***:***@')}\n`);

  const connection = await mongoose.connect(uri, { autoIndex: false });
  try {
    const result = await reconcileCreditLedger(connection.connection);
    if (result.totalUsers === 0) {
      console.log('✓ No users exist in database yet (clean slate)');
    } else if (result.ok) {
      console.log(
        `✓ All ${result.totalUsers} users match transaction history (${result.totalTransactions} transactions checked)`,
      );
    } else {
      console.error(`❌ Found ${result.mismatches.length} balance discrepancies!`);
      for (const m of result.mismatches) {
        console.error(
          `   User ${m.userId}: user.creditBalance=${m.userBalance}, ledgerSum=${m.ledgerSum}`,
        );
      }
    }
    console.log('\n================================================================');
    console.log(
      result.ok
        ? '  Result: SUCCESS — All credit balances reconciled! ✓'
        : '  Result: MISMATCH DETECTED ❌',
    );
    console.log('================================================================\n');
    return result.ok;
  } finally {
    await mongoose.disconnect();
  }
}

if (
  require.main === module ||
  (process.argv[1] && process.argv[1].endsWith('credits-reconcile.ts'))
) {
  runCreditsReconciliation()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ Reconciliation error:', err);
      process.exit(1);
    });
}
