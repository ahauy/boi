import { AppState } from 'react-native';
import { PAYWALL_RETURN_AFTER_MS } from '../premium/paywall-triggers';
import {
  isInterstitialShowingSync,
  maybeShowThen,
} from './interstitial';
import {
  getInterstitialPolicyState,
  markNoInterstitialTap,
  recordPaywallDecline,
  setInterstitialRoute,
} from './interstitial-policy';

/**
 * Interstitial Trigger Helpers (Playbook §5.4)
 *
 * Implements all 6 interstitial triggers through `maybeShowThen(trigger, next)`:
 * 1. `after_core_action`: Result arrives while progress screen is visible and app is foreground -> ad, then Result screen.
 * 2. `open_history_result`: Opening a result from list/history whose reading ID has not had an ad yet -> ad first.
 * 3. `screen_change`: Tab switch, push/pop. Opening paywall never triggers; suppressed for 1s after a `noInterstitial` tap.
 * 4. `paywall_declined`: Closing paywall via X or Back (not after purchase) -> counts a decline and triggers ad when leaving paywall.
 * 5. `background_return`: Return from background >= 10s (`{PAYWALL_RETURN_AFTER}`) when the paywall cannot open.
 * 6. `ads_user_tap`: After 3 paywall declines, every button tap not marked `noInterstitial` triggers with 30s gap;
 *    second tap while first ad is coming is dropped; if user left the screen before ad finishes, drop the tap.
 */

let adsUserTapInFlight = false;

/**
 * Trigger 1: After the core action (§5.4 #1).
 * Result arrives while the progress screen is visible and the app is foreground -> ad, then Result screen.
 */
export function triggerAfterCoreAction(
  readingId: string,
  navigateToResult: () => void,
  options?: { isProgressVisible?: boolean; isForeground?: boolean }
): boolean {
  const progressVisible =
    options?.isProgressVisible ?? getInterstitialPolicyState().isCoreActionProgressVisible;
  const appForeground =
    options?.isForeground ?? (AppState.currentState ? AppState.currentState === 'active' : true);

  if (!progressVisible || !appForeground) {
    navigateToResult();
    return false;
  }

  return maybeShowThen('after_core_action', navigateToResult, { readingId });
}

/**
 * Trigger 2: Opening a result from a list/history whose core-action tap has not had an ad yet (§5.4 #2).
 */
export function triggerOpenHistoryResult(
  readingId: string,
  openResult: () => void
): boolean {
  return maybeShowThen('open_history_result', openResult, { readingId });
}

/**
 * Trigger 3: Screen change (tab switch, push/pop) (§5.4 #3).
 * Opening the paywall never triggers.
 */
export function triggerScreenChange(
  targetRoute: string,
  performNavigation: () => void
): boolean {
  setInterstitialRoute(targetRoute);
  return maybeShowThen('screen_change', performNavigation, { targetRoute });
}

/**
 * Fires interstitial check on tab switch (§5.4 #3).
 */
export function onTabSwitchInterstitial(
  targetTab?: string,
  onDone?: () => void
): boolean {
  const route = targetTab ? (targetTab.startsWith('/') ? targetTab : `/(tabs)/${targetTab}`) : '/(tabs)';
  return triggerScreenChange(route, () => {
    onDone?.();
  });
}

/**
 * Fires interstitial check when a core flow (e.g. reading result) completes (§5.4 #1).
 */
export function onFlowCompleteInterstitial(
  flowName: string = 'reading_complete',
  onDone?: () => void
): boolean {
  return maybeShowThen('after_core_action', () => {
    onDone?.();
  });
}

/**
 * Trigger 4: Paywall declined (X or back, not after a purchase) (§5.4 #4).
 * Increments decline counter (+1, becoming `adsUser` at 3) and shows interstitial on leaving paywall.
 */
export function triggerPaywallDeclined(onAfterClose?: () => void): boolean {
  recordPaywallDecline();
  return maybeShowThen('paywall_declined', () => {
    onAfterClose?.();
  });
}

/**
 * Trigger 5: Return from background >= `{PAYWALL_RETURN_AFTER}` (10 s) when the paywall cannot open (§5.4 #5).
 */
export function triggerBackgroundReturn(
  elapsedMs: number,
  paywallOpened: boolean,
  onDone?: () => void
): boolean {
  if (paywallOpened || elapsedMs < PAYWALL_RETURN_AFTER_MS) {
    onDone?.();
    return false;
  }
  return maybeShowThen('background_return', () => {
    onDone?.();
  });
}

/**
 * Trigger 6: Ads user button tap (§5.4 #6).
 * - Buttons marked `noInterstitial` never trigger (and suppress screen_change for 1s).
 * - If not an `adsUser`, runs `action` immediately.
 * - If an `adsUser` and a tap ad is already coming/showing, a second tap is dropped.
 * - If the user left the screen (`!isScreenMounted()`) before the ad closes, drops the tap action.
 */
export function triggerAdsUserTap(
  action: () => void,
  options?: {
    noInterstitial?: boolean;
    isScreenMounted?: () => boolean;
    now?: number;
  }
): boolean {
  const now = options?.now ?? Date.now();

  if (options?.noInterstitial) {
    markNoInterstitialTap(now);
    action();
    return false;
  }

  const policy = getInterstitialPolicyState();
  if (!policy.isAdsUser) {
    action();
    return false;
  }

  // Drop a second tap while the first ad is coming/showing (§5.4 #6)
  if (adsUserTapInFlight || isInterstitialShowingSync()) {
    return false;
  }

  adsUserTapInFlight = true;
  const shown = maybeShowThen(
    'ads_user_tap',
    () => {
      adsUserTapInFlight = false;
      const stillMounted = options?.isScreenMounted ? options.isScreenMounted() : true;
      if (stillMounted) {
        action();
      }
    },
    { now }
  );

  if (!shown) {
    adsUserTapInFlight = false;
  }

  return shown;
}

export function resetInterstitialTriggersForTests(): void {
  adsUserTapInFlight = false;
}
