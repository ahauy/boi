import { initializeAds, preloadMrec, preloadRewarded } from '../ads/ads-service';
import { requestInterstitialLoad } from '../ads/interstitial';
import { hydrateInterstitialPolicy, setStartupStep3Done } from '../ads/interstitial-policy';
import { initializeAdjust } from '../ads/revenue';
import { isDeviceBlocked } from '../lib/integrity-gate';
import { initializeBilling } from '../billing/billing-service';
import { isBillingConfigured } from '../billing/billing-config';
import { tryOpenPaywallOnLaunch } from '../premium/paywall-triggers';

/**
 * Startup Sequence (Playbook §3)
 *
 * Runs once per app process when entering the Main tabs.
 * Ordered sequential steps where a failing step NEVER blocks the next:
 *   1. Wait for ads consent (<= 30 s) -> start Adjust with consent result -> preload interstitial (+ one MREC).
 *   2. Billing connect + products (<= 15 s).
 *   3. Launch paywall (non-VIP, billing on).
 */

export interface StartupContext {
  vipKnown: boolean;
  isVip: boolean;
}

export type PaywallLaunchHandler = () => Promise<void> | void;

let startupSequenceCompleted = false;
let startupPaywallStepDone = false;
let paywallHandler: PaywallLaunchHandler | null = null;

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
}

export function registerPaywallLauncher(handler: PaywallLaunchHandler): () => void {
  paywallHandler = handler;
  return () => {
    if (paywallHandler === handler) paywallHandler = null;
  };
}

/**
 * Playbook §5.2: Interstitials never show before the launch paywall step ends.
 */
export function isStartupPaywallStepDone(): boolean {
  return startupPaywallStepDone;
}

/**
 * Runs the startup sequence if not already executed in this process.
 */
export async function runStartupSequence(ctx: StartupContext): Promise<void> {
  if (startupSequenceCompleted) {
    return;
  }
  startupSequenceCompleted = true;

  if (isDev()) console.log('[StartupSequence] Starting sequence at Main tabs...');

  // Step 1: Wait for ads consent (<= 30s) -> start Adjust -> preload interstitial & MREC
  try {
    await hydrateInterstitialPolicy();
    const consentTimeoutPromise = new Promise<'UNKNOWN'>((resolve) =>
      setTimeout(() => resolve('UNKNOWN'), 30_000)
    );
    const region = await Promise.race([initializeAds(), consentTimeoutPromise]);
    if (!isDeviceBlocked()) {
      await initializeAdjust(region);
      preloadRewarded();
      if (!ctx.isVip) {
        requestInterstitialLoad();
        void preloadMrec();
      }
    }
    if (isDev()) console.log('[StartupSequence] Step 1 finished (Ads & Adjust init, preloads queued)');
  } catch (err) {
    if (isDev()) console.warn('[StartupSequence] Step 1 note:', err);
  }

  // Step 2: Billing connect + fetch products (<= 15s)
  let billingConnected = false;
  try {
    const billingTimeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 15_000)
    );
    billingConnected = await Promise.race([
      initializeBilling(),
      billingTimeoutPromise,
    ]);
    if (isDev()) console.log('[StartupSequence] Step 2 finished (Billing check)');
  } catch (err) {
    if (isDev()) console.warn('[StartupSequence] Step 2 note:', err);
  }

  // Step 3: Launch paywall (non-VIP, billing on)
  const billingEnabled = isBillingConfigured() && billingConnected;
  const shouldOpenPaywall = ctx.vipKnown && !ctx.isVip && billingEnabled;
  try {
    if (shouldOpenPaywall) {
      if (isDev()) console.log('[StartupSequence] Step 3: Launching paywall...');
      if (paywallHandler) {
        await paywallHandler();
      } else {
        await tryOpenPaywallOnLaunch();
      }
    }
  } catch (err) {
    if (isDev()) console.warn('[StartupSequence] Step 3 note:', err);
  } finally {
    startupPaywallStepDone = true;
    setStartupStep3Done(true);
  }

  if (isDev()) console.log('[StartupSequence] Finished successfully');
}

export function resetStartupSequence(): void {
  startupSequenceCompleted = false;
  startupPaywallStepDone = false;
}
