import { useCallback, useEffect, useRef } from 'react';
import { triggerAdsUserTap } from '../ads/interstitial-triggers';
import { markNoInterstitialTap } from '../ads/interstitial-policy';

/**
 * Tap Gate (Playbook §2.1, §5.4)
 *
 * Wraps every button's `onPress` so:
 * - 350ms debounce between taps
 * - Re-entrancy mutex locks during in-flight tap execution
 * - Buttons with `eligibleForAd: false` (or `noInterstitial: true`) bypass ads and record suppression
 * - For `adsUser` (after 3 paywall declines), non-exempt button taps show an interstitial first
 *   (with 30s gap), drop duplicate taps while the ad is coming, and drop the action if the screen
 *   unmounted before the ad closed.
 */

export const TAP_DEBOUNCE_MS = 350;

let lastTapTimestamp = 0;
let isMutexLocked = false;

export interface RunGatedTapOptions {
  eligibleForAd?: boolean;
  noInterstitial?: boolean;
  isScreenMounted?: () => boolean;
  now?: number;
}

export function resetTapGateForTests(): void {
  lastTapTimestamp = 0;
  isMutexLocked = false;
}

export function runGatedTap(
  action: () => any,
  options?: RunGatedTapOptions
): boolean {
  const now = options?.now ?? Date.now();

  // 1. Debounce check: 350ms debounce
  if (lastTapTimestamp > 0 && now - lastTapTimestamp < TAP_DEBOUNCE_MS) {
    return false;
  }

  // 2. Re-entrancy mutex: drop if a tap is currently being processed
  if (isMutexLocked) {
    return false;
  }

  lastTapTimestamp = now;
  isMutexLocked = true;

  const unlock = () => {
    isMutexLocked = false;
  };

  const executeAction = () => {
    try {
      const result = action();
      if (result && typeof result.then === 'function') {
        result.finally(unlock);
      } else {
        unlock();
      }
    } catch (err) {
      unlock();
      throw err;
    }
  };

  // 3. eligibleForAd: false (or noInterstitial: true) bypass
  const eligible = options?.eligibleForAd !== false && !options?.noInterstitial;
  if (!eligible) {
    markNoInterstitialTap(now);
    executeAction();
    return true;
  }

  // 4. If eligible for ad, route through triggerAdsUserTap
  triggerAdsUserTap(
    () => {
      executeAction();
    },
    {
      noInterstitial: false,
      isScreenMounted: options?.isScreenMounted,
      now,
    }
  );

  return true;
}

export interface TapGateOptions {
  /**
   * When true, this button never triggers an interstitial and suppresses any
   * screen-change interstitial for 1 second (§5.4).
   */
  noInterstitial?: boolean;
  /**
   * Checks whether the originating screen is still mounted when the ad finishes.
   */
  isScreenMounted?: () => boolean;
}

/**
 * Imperative tap-gate helper (used by components and unit tests).
 */
export function gateTap(action: () => void, options?: TapGateOptions): void {
  runGatedTap(action, {
    eligibleForAd: !options?.noInterstitial,
    noInterstitial: options?.noInterstitial,
    isScreenMounted: options?.isScreenMounted,
  });
}

/**
 * React hook that wraps an `onPress` callback with `gateTap` and tracks mount state automatically.
 */
export function useTapGate<T extends (...args: any[]) => any>(
  onPress: T | undefined,
  options?: { noInterstitial?: boolean }
): (...args: Parameters<T>) => void {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (!onPress) return;
      gateTap(
        () => {
          onPress(...args);
        },
        {
          noInterstitial: options?.noInterstitial,
          isScreenMounted: () => mountedRef.current,
        }
      );
    },
    [onPress, options?.noInterstitial]
  );
}
