import { ADS_CONFIG, adsInBuild } from './ads-config';
import { subscribeAdEvent } from './ad-events';
import { isInterstitialReady, preloadInterstitial, showInterstitial } from './ads-service';
import { adsStore } from './ads-store';
import {
  canTriggerInterstitial,
  InterstitialTrigger,
  markReadingInterstitialShown,
  recordInterstitialShown,
} from './interstitial-policy';

/**
 * Single-Instance Interstitial Manager (Playbook §5.4, §11)
 *
 * - Single entry point `maybeShowThen(trigger, next)`:
 *   Decides SYNCHRONOUSLY (all caps/exclusions pass and an ad is already loaded).
 *   If yes: shows the ad and runs `next()` after close (`hidden`) or `display_failed`.
 *   If no: runs `next()` immediately. Never waits for a load.
 * - Loading lifecycle:
 *   Preloads after init and after every show/fail.
 *   Retries failed loads with exponential backoff: 2, 4, 8, 16, 32, 64 s.
 *   Reloads a stuck load with no answer after 60 s.
 *   `isAdReady` check timeout <= 2 s.
 */

export const BACKOFF_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 64_000] as const;
export const STUCK_LOAD_TIMEOUT_MS = 60_000;
export const IS_READY_TIMEOUT_MS = 2_000;
export const MISSING_HIDDEN_FALLBACK_MS = 8_000;

let isLoaded = false;
let isLoading = false;
let isShowing = false;
let retryAttempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let stuckLoadTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCompletion: (() => void) | null = null;
let listenersBound = false;

function clearTimers(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (stuckLoadTimer) {
    clearTimeout(stuckLoadTimer);
    stuckLoadTimer = null;
  }
}

function finishCurrentShow(): void {
  if (!isShowing && !pendingCompletion) return;
  isShowing = false;
  isLoaded = false;
  adsStore.dismissFullScreenAd(`interstitial:${ADS_CONFIG.units.interstitial}`);
  const cb = pendingCompletion;
  pendingCompletion = null;
  // Preload next ad immediately after every show/fail (§5.4)
  requestInterstitialLoad();
  if (cb) {
    try {
      cb();
    } catch (err) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[Interstitial] Next callback error:', err);
      }
    }
  }
}

function ensureInterstitialListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  const unitId = ADS_CONFIG.units.interstitial;

  subscribeAdEvent('interstitial', unitId, 'loaded', () => {
    clearTimers();
    isLoading = false;
    isLoaded = true;
    retryAttempt = 0;
  });

  subscribeAdEvent('interstitial', unitId, 'load_failed', () => {
    clearTimers();
    isLoading = false;
    isLoaded = false;
    const delay =
      BACKOFF_DELAYS_MS[Math.min(retryAttempt, BACKOFF_DELAYS_MS.length - 1)];
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      requestInterstitialLoad();
    }, delay);
  });

  subscribeAdEvent('interstitial', unitId, 'displayed', () => {
    isLoaded = false;
  });

  subscribeAdEvent('interstitial', unitId, 'display_failed', () => {
    finishCurrentShow();
  });

  subscribeAdEvent('interstitial', unitId, 'hidden', () => {
    finishCurrentShow();
  });

  // Also watch adsStore fullScreenAdShowing in case Pitfall §11.2 force-clears after 1s on foreground
  adsStore.subscribe(() => {
    if (isShowing && !adsStore.getState().fullScreenAdShowing) {
      finishCurrentShow();
    }
  });
}

/**
 * Initiates an interstitial preload with a 60s stuck-load watchdog (§5.4).
 */
export function requestInterstitialLoad(): void {
  ensureInterstitialListeners();
  if (!adsInBuild() || isLoaded || isLoading || isShowing) {
    return;
  }

  isLoading = true;
  if (stuckLoadTimer) clearTimeout(stuckLoadTimer);
  stuckLoadTimer = setTimeout(() => {
    // Reload a load with no answer after 60 s (§5.4)
    stuckLoadTimer = null;
    if (isLoading && !isLoaded) {
      isLoading = false;
      requestInterstitialLoad();
    }
  }, STUCK_LOAD_TIMEOUT_MS);

  preloadInterstitial(ADS_CONFIG.units.interstitial);
}

/**
 * Checks `isInterstitialReady` with a <= 2s timeout (§5.4) and syncs the `isLoaded` flag.
 */
export async function checkInterstitialReadyWithTimeout(
  timeoutMs: number = IS_READY_TIMEOUT_MS
): Promise<boolean> {
  if (isLoaded) return true;
  try {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    const ready = await Promise.race([
      isInterstitialReady(ADS_CONFIG.units.interstitial),
      timeoutPromise,
    ]);
    if (timer) clearTimeout(timer);
    if (ready) {
      isLoaded = true;
    }
    return ready;
  } catch {
    return false;
  }
}

export function isInterstitialLoadedSync(): boolean {
  return isLoaded;
}

export function isInterstitialShowingSync(): boolean {
  return isShowing;
}

/**
 * Test/mock helper to set loaded state directly.
 */
export function setInterstitialLoadedForTests(loaded: boolean): void {
  ensureInterstitialListeners();
  isLoaded = loaded;
  if (loaded) {
    isLoading = false;
  }
}

export interface MaybeShowOptions {
  now?: number;
  targetRoute?: string;
  readingId?: string;
}

/**
 * Single synchronous entry point `maybeShowThen(trigger, next)` (§5.4):
 * - Decides synchronously whether all caps/exclusions pass and an ad is already loaded.
 * - If yes: shows the ad and runs `next` after close/fail.
 * - If no: runs `next` immediately (and triggers a background preload if not loaded).
 */
export function maybeShowThen(
  trigger: InterstitialTrigger,
  next: () => void,
  options?: MaybeShowOptions
): boolean {
  ensureInterstitialListeners();

  // If an interstitial is already in flight, drop or run next according to trigger
  if (isShowing) {
    if (trigger !== 'ads_user_tap') {
      next();
    }
    return false;
  }

  const now = options?.now ?? Date.now();
  const allowed = canTriggerInterstitial(trigger, {
    now,
    targetRoute: options?.targetRoute,
    readingId: options?.readingId,
  });

  if (!allowed) {
    next();
    return false;
  }

  if (!isLoaded) {
    // Never wait for a load (§5.4): run next immediately and ensure a load is queued
    requestInterstitialLoad();
    next();
    return false;
  }

  // All caps pass and ad is loaded -> show ad first, run `next` after close/fail
  isLoaded = false;
  isShowing = true;
  recordInterstitialShown(now);

  if (options?.readingId) {
    markReadingInterstitialShown(options.readingId);
  }

  const adKey = `interstitial:${ADS_CONFIG.units.interstitial}`;
  adsStore.requestFullScreenAd(adKey);

  let completed = false;
  pendingCompletion = () => {
    if (completed) return;
    completed = true;
    next();
  };

  try {
    showInterstitial(ADS_CONFIG.units.interstitial, trigger);
  } catch {
    finishCurrentShow();
  }

  return true;
}

export function resetInterstitialManagerForTests(): void {
  clearTimers();
  isLoaded = false;
  isLoading = false;
  isShowing = false;
  retryAttempt = 0;
  pendingCompletion = null;
}
