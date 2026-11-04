import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ECONOMY_DEFAULTS } from '@palmsight/shared';
import { adsStore } from '../ads/ads-store';
import { isExternalActivityActive } from '../lib/external-activity';
import { isBillingConfigured } from '../billing/billing-config';
import { billingStore } from '../billing/billing-store';
import { setPaywallDeclineCount } from '../ads/interstitial-policy';

/**
 * Paywall State & Triggers (Playbook §5.4, §6.2, §6.3, §6.4, §11.8)
 */

const DECLINES_STORAGE_KEY = 'palmsight.paywallDeclines';
export const PAYWALL_RETURN_AFTER_MS =
  ECONOMY_DEFAULTS.PAYWALL_RETURN_AFTER_SECONDS * 1000; // 10_000 ms
export const PAYWALL_CLOSE_DELAY_MS = ECONOMY_DEFAULTS.PAYWALL_CLOSE_DELAY_MS; // 1_500 ms
export const ADS_USER_DECLINES_THRESHOLD = ECONOMY_DEFAULTS.ADS_USER_DECLINES; // 3

export type PaywallOpenSource =
  | 'launch'
  | 'background_return'
  | 'not_enough_sheet'
  | 'out_of_currency'
  | 'settings_vip'
  | 'settings_entry'
  | 'settings_currency_row'
  | 'vip_school_locked'
  | 'locked_feature'
  | 'no_ad_wait_sheet'
  | 'streak_restore_popup'
  | 'manual';

export interface PaywallTriggerState {
  isOpen: boolean;
  source: PaywallOpenSource | null;
  declineCount: number;
  isAdsUser: boolean;
  vipKnown: boolean;
  isVip: boolean;
  currentRoute: string;
  openSheetsCount: number;
}

const EXCLUDED_AUTO_PAYWALL_ROUTE_PATTERNS = [
  /^\/?onboarding/i,
  /^\/?intro/i,
  /^\/?login/i,
  /^\/?register/i,
  /^\/?sign-in/i,
  /^\/?auth/i,
  /^\/?consent/i,
  /^\/?camera/i,
  /^\/?scan-progress/i,
  /^\/?reading\//i,
  /^\/?paywall/i,
];

let state: PaywallTriggerState = {
  isOpen: false,
  source: null,
  declineCount: 0,
  isAdsUser: false,
  vipKnown: false,
  isVip: false,
  currentRoute: '/',
  openSheetsCount: 0,
};

let backgroundEnteredAt: number | null = null;
let closeWaitResolvers: Array<() => void> = [];
const listeners = new Set<() => void>();
const declineCallbacks = new Set<() => void>();
const fallbackInterstitialOnReturnCallbacks = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[PaywallTriggers] Listener error:', err);
      }
    }
  }
}

export async function loadPaywallDeclines(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(DECLINES_STORAGE_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    const count = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    state = {
      ...state,
      declineCount: count,
      isAdsUser: !state.isVip && count >= ADS_USER_DECLINES_THRESHOLD,
    };
    setPaywallDeclineCount(count);
    notify();
    return count;
  } catch {
    return state.declineCount;
  }
}

async function persistDeclineCount(count: number): Promise<void> {
  try {
    if (count <= 0) {
      await AsyncStorage.removeItem(DECLINES_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(DECLINES_STORAGE_KEY, String(count));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Syncs VIP status from `/v1/me`.
 * Playbook §5.4: Ads user decline counter is cleared when the account becomes VIP.
 */
export function syncPaywallVipState(params: {
  vipKnown: boolean;
  isVip: boolean;
}): void {
  const nextDeclines = params.isVip ? 0 : state.declineCount;
  const changed =
    state.vipKnown !== params.vipKnown ||
    state.isVip !== params.isVip ||
    state.declineCount !== nextDeclines;

  state = {
    ...state,
    vipKnown: params.vipKnown,
    isVip: params.isVip,
    declineCount: nextDeclines,
    isAdsUser: !params.isVip && nextDeclines >= ADS_USER_DECLINES_THRESHOLD,
  };

  if (params.isVip) {
    void persistDeclineCount(0);
  }

  if (changed) {
    notify();
  }
}

export function setCurrentPaywallRoute(route: string): void {
  const normalized = route || '/';
  if (state.currentRoute !== normalized) {
    state = { ...state, currentRoute: normalized };
    notify();
  }
}

/**
 * Registers an open bottom sheet / modal so automatic paywall triggers skip while a sheet is open (§6.3).
 */
export function registerOpenSheet(): () => void {
  state = { ...state, openSheetsCount: state.openSheetsCount + 1 };
  notify();
  let unregistered = false;
  return () => {
    if (unregistered) return;
    unregistered = true;
    state = {
      ...state,
      openSheetsCount: Math.max(0, state.openSheetsCount - 1),
    };
    notify();
  };
}

export function isRouteExcludedFromAutoPaywall(route: string): boolean {
  const clean = (route || '/').trim();
  return EXCLUDED_AUTO_PAYWALL_ROUTE_PATTERNS.some((regex) =>
    regex.test(clean),
  );
}

/**
 * Playbook §6.3: Checks if the paywall is allowed to open automatically right now.
 *
 * NEVER when:
 * - on onboarding / sign-in / consent / camera / core-action progress or result / paywall itself
 * - a full-screen ad is showing
 * - a sheet is open (skip, don't defer)
 * - VIP is active or VIP is unknown
 * - billing is off
 * - external-activity is active (or ended <= 2 s before)
 */
export function canAutoOpenPaywall(options?: {
  ignoreRouteCheck?: boolean;
}): boolean {
  if (state.isOpen) return false;
  if (!isBillingConfigured() || !billingStore.getState().billingEnabled) {
    return false;
  }
  if (!state.vipKnown || state.isVip) {
    return false;
  }
  if (adsStore.getState().fullScreenAdShowing) {
    return false;
  }
  if (state.openSheetsCount > 0) {
    return false;
  }
  if (isExternalActivityActive()) {
    return false;
  }
  if (
    !options?.ignoreRouteCheck &&
    isRouteExcludedFromAutoPaywall(state.currentRoute)
  ) {
    return false;
  }
  return true;
}

/**
 * Opens the paywall manually (§6.4) or from an approved automatic trigger (§6.3).
 * Returns a Promise that resolves when the paywall closes.
 */
export function openPaywall(
  source: PaywallOpenSource = 'manual',
): Promise<void> {
  if (!isBillingConfigured() || !billingStore.getState().billingEnabled) {
    return Promise.resolve();
  }

  if (!state.isOpen) {
    state = {
      ...state,
      isOpen: true,
      source,
    };
    notify();
  }

  return new Promise<void>((resolve) => {
    closeWaitResolvers.push(resolve);
  });
}

/**
 * Startup Step 3 (§3 & §6.3): Launch paywall (non-VIP, billing on).
 */
export async function tryOpenPaywallOnLaunch(): Promise<boolean> {
  if (!canAutoOpenPaywall({ ignoreRouteCheck: true })) {
    return false;
  }
  await openPaywall('launch');
  return true;
}

/**
 * Closes the paywall after purchase success or "Done" on VIP view (does NOT count as a decline).
 */
export function closePaywallAfterSuccess(): void {
  if (!state.isOpen) return;
  state = {
    ...state,
    isOpen: false,
    source: null,
  };
  const resolvers = [...closeWaitResolvers];
  closeWaitResolvers = [];
  notify();
  for (const resolve of resolvers) {
    resolve();
  }
}

/**
 * Closes the paywall via X or Android Back (not after a purchase) (§5.4 & §6.2):
 * - Increments decline count (3 declines -> Ads user).
 * - Invokes registered decline callbacks so interstitial trigger #4 can run.
 */
export function declinePaywall(): void {
  if (!state.isOpen) return;

  const nextDeclines = state.isVip ? 0 : state.declineCount + 1;
  state = {
    ...state,
    isOpen: false,
    source: null,
    declineCount: nextDeclines,
    isAdsUser: !state.isVip && nextDeclines >= ADS_USER_DECLINES_THRESHOLD,
  };

  void persistDeclineCount(nextDeclines);

  const resolvers = [...closeWaitResolvers];
  closeWaitResolvers = [];
  notify();

  for (const resolve of resolvers) {
    resolve();
  }

  for (const cb of declineCallbacks) {
    try {
      cb();
    } catch (err) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[PaywallTriggers] Decline callback error:', err);
      }
    }
  }
}

export function onPaywallDeclined(callback: () => void): () => void {
  declineCallbacks.add(callback);
  return () => {
    declineCallbacks.delete(callback);
  };
}

/**
 * Playbook §3 & §5.4 Trigger 5: When returning from background >= 10s and the paywall cannot open,
 * notify interstitial fallback listeners.
 */
export function onPaywallSkippedOnReturn(callback: () => void): () => void {
  fallbackInterstitialOnReturnCallbacks.add(callback);
  return () => {
    fallbackInterstitialOnReturnCallbacks.delete(callback);
  };
}

/**
 * Handles return from background after >= `{PAYWALL_RETURN_AFTER}` (10 s), no cooldown (§6.3).
 */
export function handlePaywallForegroundReturn(elapsedMs: number): boolean {
  if (elapsedMs < PAYWALL_RETURN_AFTER_MS) {
    return false;
  }

  // Never trigger if the app itself caused the background trip (§6.3, §11.8)
  if (isExternalActivityActive()) {
    return false;
  }

  if (canAutoOpenPaywall()) {
    void openPaywall('background_return');
    return true;
  }

  // Playbook §3 & §5.4 Trigger 5: Returning >= 10s when the paywall cannot open -> trigger interstitial fallback
  for (const cb of fallbackInterstitialOnReturnCallbacks) {
    try {
      cb();
    } catch {
      // Ignore listener error
    }
  }
  return false;
}

function handleAppStateChange(nextState: AppStateStatus): void {
  if (nextState === 'background' || nextState === 'inactive') {
    if (backgroundEnteredAt === null) {
      backgroundEnteredAt = Date.now();
    }
  } else if (nextState === 'active') {
    if (backgroundEnteredAt !== null) {
      const elapsed = Date.now() - backgroundEnteredAt;
      backgroundEnteredAt = null;
      handlePaywallForegroundReturn(elapsed);
    }
  }
}

try {
  AppState.addEventListener('change', handleAppStateChange);
} catch {
  // Non-native fallback
}

export const paywallStore = {
  getState(): PaywallTriggerState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  reset(): void {
    state = {
      isOpen: false,
      source: null,
      declineCount: 0,
      isAdsUser: false,
      vipKnown: false,
      isVip: false,
      currentRoute: '/',
      openSheetsCount: 0,
    };
    backgroundEnteredAt = null;
    closeWaitResolvers = [];
    notify();
  },
};

export function triggerPaywall(
  source: PaywallOpenSource | string = 'manual'
): Promise<void> {
  return openPaywall(source as PaywallOpenSource);
}

export function usePaywallTriggerState(): PaywallTriggerState {
  const [snap, setSnap] = useState<PaywallTriggerState>(
    paywallStore.getState(),
  );

  useEffect(() => {
    return paywallStore.subscribe(() => {
      setSnap(paywallStore.getState());
    });
  }, []);

  return snap;
}
