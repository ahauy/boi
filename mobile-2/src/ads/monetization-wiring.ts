import { setPaywallDeclineCount } from './interstitial-policy';
import { triggerBackgroundReturn, triggerPaywallDeclined } from './interstitial-triggers';
import {
  onPaywallDeclined,
  onPaywallSkippedOnReturn,
  paywallStore,
} from '../premium/paywall-triggers';

/**
 * Connects paywall events to interstitial triggers #4 and #5 (Playbook §5.4). The paywall
 * module owns the decline count; the interstitial policy mirrors it to decide who is an ads user.
 */

let wired = false;

export function wireMonetizationTriggers(): void {
  if (wired) return;
  wired = true;

  onPaywallDeclined(() => {
    setPaywallDeclineCount(paywallStore.getState().declineCount);
    triggerPaywallDeclined();
  });
  onPaywallSkippedOnReturn(() => {
    triggerBackgroundReturn();
  });
}
