import AsyncStorage from '@react-native-async-storage/async-storage';
import { canShowAds } from './ads-config';
import { adsStore, addOnAdShownListener } from './ads-store';
import { isExternalActivityActive } from '../lib/external-activity';

/**
 * Interstitial Policy & Persistence (Playbook §5.2, §5.4, §12)
 *
 * - INTERSTITIAL_GAP_MS = 90_000 (90s)
 * - ADS_USER_GAP_MS = 30_000 (30s)
 * - ADS_USER_DECLINES = 3
 * - SESSION_WARMUP_MS = 15_000 (15s)
 * - FIRST_INTERSTITIAL_GAP_MS = 45_000 (45s)
 * - MAX_INTERSTITIALS_PER_SESSION = 6
 * - POST_REWARDED_COOLDOWN_MS = 20_000 (20s)
 * - Persists `lastInterstitialShownAt` and `paywallDeclineCount` in AsyncStorage
 *   so cooldowns and ads-user status survive app restarts.
 */

export const INTERSTITIAL_GAP_MS = 90_000;
export const SUBSEQUENT_INTERSTITIAL_GAP_MS = 90_000;
export const ADS_USER_GAP_MS = 30_000;
export const ADS_USER_DECLINES = 3;
export const NO_INTERSTITIAL_SUPPRESSION_MS = 1_000;
export const SESSION_WARMUP_MS = 15_000;
export const FIRST_INTERSTITIAL_GAP_MS = 45_000;
export const MAX_INTERSTITIALS_PER_SESSION = 6;
export const POST_REWARDED_COOLDOWN_MS = 20_000;

export const STORAGE_KEYS = {
  LAST_SHOWN_AT: 'palmsight.lastInterstitialShownAt',
  PAYWALL_DECLINES: 'palmsight.paywallDeclines',
} as const;

export type InterstitialTrigger =
  | 'after_core_action'
  | 'open_history_result'
  | 'screen_change'
  | 'paywall_declined'
  | 'background_return'
  | 'ads_user_tap';

export interface InterstitialPolicyState {
  lastInterstitialShownAt: number;
  paywallDeclineCount: number;
  isAdsUser: boolean;
  vipKnown: boolean;
  isVip: boolean;
  currentRoute: string;
  isCoreActionProgressVisible: boolean;
  startupStep3Done: boolean;
  lastNoInterstitialTapAt: number;
}

const EXCLUDED_INTERSTITIAL_ROUTE_PATTERNS = [
  /^\/?onboarding/i,
  /^\/?intro/i,
  /^\/?consent/i,
  /^\/?paywall/i,
  /^\/?sign-in/i,
  /^\/?login/i,
  /^\/?register/i,
  /^\/?auth/i,
];

let sessionStartTime = Date.now();
let interstitialsShownInSession = 0;
let lastRewardedShownAt = 0;

addOnAdShownListener((now) => {
  lastRewardedShownAt = now;
});

export function setSessionStartTimeForTests(time: number): void {
  sessionStartTime = time;
}

export function recordRewardedShown(now: number = Date.now()): void {
  lastRewardedShownAt = now;
}

export function getSessionInterstitialsCount(): number {
  return interstitialsShownInSession;
}

let state: InterstitialPolicyState = {
  lastInterstitialShownAt: 0,
  paywallDeclineCount: 0,
  isAdsUser: false,
  vipKnown: false,
  isVip: false,
  currentRoute: '/',
  isCoreActionProgressVisible: false,
  startupStep3Done: false,
  lastNoInterstitialTapAt: 0,
};

const shownReadingIds = new Set<string>();

/**
 * Hydrate persisted interstitial gap and paywall decline count from AsyncStorage (§12).
 */
export async function hydrateInterstitialPolicy(): Promise<InterstitialPolicyState> {
  try {
    const [rawShownAt, rawDeclines] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.LAST_SHOWN_AT),
      AsyncStorage.getItem(STORAGE_KEYS.PAYWALL_DECLINES),
    ]);

    const parsedShownAt = rawShownAt ? parseInt(rawShownAt, 10) : 0;
    const parsedDeclines = rawDeclines ? parseInt(rawDeclines, 10) : 0;

    const lastShown = Number.isFinite(parsedShownAt) && parsedShownAt > 0 ? parsedShownAt : 0;
    const declines =
      state.isVip
        ? 0
        : Number.isFinite(parsedDeclines) && parsedDeclines > 0
          ? parsedDeclines
          : 0;

    state = {
      ...state,
      lastInterstitialShownAt: lastShown,
      paywallDeclineCount: declines,
      isAdsUser: !state.isVip && declines >= ADS_USER_DECLINES,
    };
  } catch {
    // Graceful fallback if AsyncStorage fails
  }
  return state;
}

export function getInterstitialPolicyState(): InterstitialPolicyState {
  return state;
}

/**
 * Update VIP state and clear ads-user / decline count when VIP becomes true (§5.4).
 */
export function setInterstitialVipState(params: { vipKnown: boolean; isVip: boolean }): void {
  const nextDeclines = params.isVip ? 0 : state.paywallDeclineCount;
  state = {
    ...state,
    vipKnown: params.vipKnown,
    isVip: params.isVip,
    paywallDeclineCount: nextDeclines,
    isAdsUser: !params.isVip && nextDeclines >= ADS_USER_DECLINES,
  };

  if (params.isVip) {
    void AsyncStorage.removeItem(STORAGE_KEYS.PAYWALL_DECLINES).catch(() => undefined);
  }
}

export function setInterstitialRoute(route: string): void {
  state = {
    ...state,
    currentRoute: route || '/',
  };
}

export function setCoreActionProgressVisible(visible: boolean): void {
  state = {
    ...state,
    isCoreActionProgressVisible: visible,
  };
}

export function setStartupStep3Done(done: boolean): void {
  state = {
    ...state,
    startupStep3Done: done,
  };
}

/**
 * Record a paywall decline (X or Back, not after purchase).
 * Increments decline count; at 3 declines, user becomes an `adsUser` (§5.4).
 */
export function recordPaywallDecline(now: number = Date.now()): number {
  if (state.isVip) {
    return 0;
  }
  const next = state.paywallDeclineCount + 1;
  state = {
    ...state,
    paywallDeclineCount: next,
    isAdsUser: next >= ADS_USER_DECLINES,
  };
  void AsyncStorage.setItem(STORAGE_KEYS.PAYWALL_DECLINES, String(next)).catch(() => undefined);
  void now;
  return next;
}

/**
 * Set paywall decline count directly (e.g., when synced from paywall-triggers).
 */
export function setPaywallDeclineCount(count: number): void {
  const normalized = state.isVip ? 0 : Math.max(0, count);
  state = {
    ...state,
    paywallDeclineCount: normalized,
    isAdsUser: !state.isVip && normalized >= ADS_USER_DECLINES,
  };
  if (normalized <= 0) {
    void AsyncStorage.removeItem(STORAGE_KEYS.PAYWALL_DECLINES).catch(() => undefined);
  } else {
    void AsyncStorage.setItem(STORAGE_KEYS.PAYWALL_DECLINES, String(normalized)).catch(
      () => undefined
    );
  }
}

/**
 * Record that an interstitial was shown at `now` and persist to AsyncStorage (§12).
 */
export function recordInterstitialShown(now: number = Date.now()): void {
  interstitialsShownInSession += 1;
  state = {
    ...state,
    lastInterstitialShownAt: now,
  };
  void AsyncStorage.setItem(STORAGE_KEYS.LAST_SHOWN_AT, String(now)).catch(() => undefined);
}

/**
 * Mark a `noInterstitial` button tap (§5.4):
 * - Never triggers an ads-user tap interstitial
 * - Suppresses any `screen_change` interstitial for the next 1000 ms
 */
export function markNoInterstitialTap(now: number = Date.now()): void {
  state = {
    ...state,
    lastNoInterstitialTapAt: now,
  };
}

export function isWithinNoInterstitialWindow(now: number = Date.now()): boolean {
  if (state.lastNoInterstitialTapAt <= 0) return false;
  return now - state.lastNoInterstitialTapAt < NO_INTERSTITIAL_SUPPRESSION_MS;
}

/**
 * Checks whether a route is excluded from showing interstitials (§5.2).
 */
export function isInterstitialRouteExcluded(route: string = state.currentRoute): boolean {
  const clean = (route || '/').trim();
  return EXCLUDED_INTERSTITIAL_ROUTE_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Track reading IDs that have already had an interstitial so each core-action
 * reading triggers at most 1 interstitial (§5.2, §5.4 #1 & #2).
 */
export function hasReadingShownInterstitial(readingId: string): boolean {
  return shownReadingIds.has(readingId);
}

export function markReadingInterstitialShown(readingId: string): void {
  if (readingId) {
    shownReadingIds.add(readingId);
  }
}

/**
 * Returns the required cooldown gap in ms based on whether the user is an `adsUser` (§5.4).
 */
export function getRequiredInterstitialGapMs(): number {
  return state.isAdsUser ? ADS_USER_GAP_MS : INTERSTITIAL_GAP_MS;
}

/**
 * Synchronously evaluates whether an interstitial is allowed to show for `trigger` at `now` (§5.2, §5.4).
 */
export function canTriggerInterstitial(
  trigger: InterstitialTrigger,
  options?: {
    now?: number;
    targetRoute?: string;
    readingId?: string;
  }
): boolean {
  const now = options?.now ?? Date.now();

  // 1. Format permission: must be Android build, known VIP status, and non-VIP (§5.1)
  if (!canShowAds('interstitial', { vipKnown: state.vipKnown, isVip: state.isVip })) {
    return false;
  }

  // 2. External activity suppression: cannot show while external activity is active or within grace period (§11.8)
  if (isExternalActivityActive()) {
    return false;
  }

  // 3. Max interstitials per session cap (max 6/session)
  if (interstitialsShownInSession >= MAX_INTERSTITIALS_PER_SESSION) {
    return false;
  }

  // 4. Session warmup: no interstitials during first 15s of session (<15s false)
  if (now - sessionStartTime < SESSION_WARMUP_MS) {
    return false;
  }

  // 5. First interstitial delay: must wait at least 45s from session start (first >=45s)
  if (interstitialsShownInSession === 0 && now - sessionStartTime < FIRST_INTERSTITIAL_GAP_MS) {
    return false;
  }

  // 6. Post-rewarded cooldown: 20s cooldown after a rewarded ad is shown/completed
  if (lastRewardedShownAt > 0 && now - lastRewardedShownAt < POST_REWARDED_COOLDOWN_MS) {
    return false;
  }

  // 7. Startup step 3 (launch paywall step) must have ended (§5.2)
  if (!state.startupStep3Done) {
    return false;
  }

  // 8. Another full-screen ad must not already be showing
  if (adsStore.getState().fullScreenAdShowing) {
    return false;
  }

  // 9. Core-action progress screen exclusion (§5.2)
  // Exception: `after_core_action` fires right as the result arrives to transition to Result screen
  if (state.isCoreActionProgressVisible && trigger !== 'after_core_action') {
    return false;
  }

  // 10. Excluded routes check (§5.2)
  const routeToCheck = options?.targetRoute ?? state.currentRoute;
  // Exception: `paywall_declined` fires when leaving the paywall
  if (trigger !== 'paywall_declined' && isInterstitialRouteExcluded(routeToCheck)) {
    return false;
  }
  if (trigger === 'screen_change' && options?.targetRoute && isInterstitialRouteExcluded(options.targetRoute)) {
    return false;
  }

  // 11. Trigger-specific rules
  if (trigger === 'ads_user_tap' && !state.isAdsUser) {
    return false;
  }

  if (trigger === 'screen_change' && isWithinNoInterstitialWindow(now)) {
    return false;
  }

  if (
    (trigger === 'after_core_action' || trigger === 'open_history_result') &&
    options?.readingId &&
    hasReadingShownInterstitial(options.readingId)
  ) {
    return false;
  }

  // 12. Minimum time gap between interstitials (subsequent >=90s, or 30s for adsUser) (§5.2, §5.4)
  if (state.lastInterstitialShownAt > 0) {
    const gapMs = getRequiredInterstitialGapMs();
    if (now - state.lastInterstitialShownAt < gapMs) {
      return false;
    }
  }

  return true;
}

export function resetInterstitialPolicyForTests(): void {
  sessionStartTime = Date.now();
  interstitialsShownInSession = 0;
  lastRewardedShownAt = 0;
  state = {
    lastInterstitialShownAt: 0,
    paywallDeclineCount: 0,
    isAdsUser: false,
    vipKnown: false,
    isVip: false,
    currentRoute: '/',
    isCoreActionProgressVisible: false,
    startupStep3Done: false,
    lastNoInterstitialTapAt: 0,
  };
  shownReadingIds.clear();
}
