import { Platform } from 'react-native';
import type * as MaxModule from 'react-native-applovin-max';
import { ADS_CONFIG, adsInBuild } from './ads-config';
import { AdEventFormat, dispatchAdEvent, subscribeAdEvent } from './ad-events';
import { adsStore, ConsentRegion } from './ads-store';
import { reportMissingHiddenEvent, trackAdRevenue, TrackRevenuePayload } from './revenue';
import { checkDeviceIntegrity } from '../lib/integrity-gate';
import {
  finishExternalActivity,
  recordAdClick,
  recordExternalActivity,
} from '../lib/external-activity';

/**
 * Ads Service (Playbook §2.1, §3, §5.1, §5.2, §5.4, §5.5, §11)
 *
 * THE ONLY FILE THAT IMPORTS THE AD SDK. Handles the AppLovin MAX lifecycle, the Google UMP
 * consent flow, and the load/show wrappers. Without the native module (Expo Go, web) the SDK
 * is null and only the dev simulators in SimulatedAdHost can stand in for it.
 */

export type MaxSdk = typeof MaxModule;

function loadMaxSdk(): MaxSdk | null {
  if (Platform.OS !== 'android') return null;
  try {
    return require('react-native-applovin-max') as MaxSdk;
  } catch {
    return null;
  }
}

let Max: MaxSdk | null = loadMaxSdk();

export function getMaxSdk(): MaxSdk | null {
  return Max;
}

export function setMaxSdkForTesting(sdk: MaxSdk | null): void {
  Max = sdk;
  resetAdsServiceForTesting();
}

export const REWARDED_READY_CHECK_MS = 2_000;
export const REWARDED_LOAD_TIMEOUT_MS = 15_000;
export const REWARDED_DISPLAY_TIMEOUT_MS = 5_000;
export const LATE_REWARD_WAIT_MS = 1_500;
const LOAD_BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 64_000] as const;

export type RewardedShowResult = 'rewarded' | 'closed' | 'failed';

export interface ShowRewardedOptions {
  placement: string;
  /** Passed to MAX as custom data, so S2S reward callbacks can match the ticket (§5.5). */
  customData?: string;
  /** Fires inside the SDK reward callback, so the claim is not delayed until the ad closes. */
  onReward?: () => void;
}

export type SimulatedRewardedPlayerFn = (
  placement?: string
) => Promise<{ rewarded: boolean; completed: boolean }>;

export type SimulatedInterstitialPlayerFn = (placement?: string) => Promise<void>;

let simulatedRewardedPlayer: SimulatedRewardedPlayerFn | null = null;
let simulatedInterstitialPlayer: SimulatedInterstitialPlayerFn | null = null;

export function setSimulatedRewardedPlayer(fn: SimulatedRewardedPlayerFn | null): void {
  simulatedRewardedPlayer = fn;
}

export function setSimulatedInterstitialPlayer(fn: SimulatedInterstitialPlayerFn | null): void {
  simulatedInterstitialPlayer = fn;
}

let initPromise: Promise<ConsentRegion> | null = null;
let listenersRegistered = false;
let rewardedRetryAttempt = 0;
let rewardedRetryTimer: ReturnType<typeof setTimeout> | null = null;
let preloadedMrecId: number | undefined;
let preloadedMrecReady = false;
const displayedNetworks = new Map<string, string>();

function geographyToRegion(sdk: MaxSdk, geography: MaxModule.ConsentFlowUserGeography): ConsentRegion {
  if (geography === sdk.ConsentFlowUserGeography.GDPR) return 'GDPR';
  if (geography === sdk.ConsentFlowUserGeography.OTHER) return 'OTHER';
  return 'UNKNOWN';
}

async function startSdk(): Promise<ConsentRegion> {
  // Blocked devices never initialize ads (§3, §11.12).
  if (checkDeviceIntegrity().blocked) {
    adsStore.setStatus('failed');
    return 'UNKNOWN';
  }

  if (!adsInBuild() || !Max) {
    adsStore.setStatus('ready');
    adsStore.setConsentRegion('OTHER');
    return 'OTHER';
  }

  adsStore.setStatus('initializing');

  try {
    const AppLovinMAX = Max.default;
    registerSdkListeners(Max);

    AppLovinMAX.setTermsAndPrivacyPolicyFlowEnabled(true);
    AppLovinMAX.setPrivacyPolicyUrl(ADS_CONFIG.urls.privacy);
    AppLovinMAX.setTermsOfServiceUrl(ADS_CONFIG.urls.terms);

    if (ADS_CONFIG.testDeviceIds.length > 0) {
      AppLovinMAX.setTestDeviceAdvertisingIds(ADS_CONFIG.testDeviceIds);
    }

    // Never send user identifiers (§5.1): setUserId is deliberately not called.
    const configuration = await AppLovinMAX.initialize(ADS_CONFIG.appLovinSdkKey);
    const region = geographyToRegion(Max, configuration.consentFlowUserGeography);

    if (__DEV__) {
      console.log(
        `[Ads] initialized region=${region} testMode=${configuration.isTestModeEnabled}`
      );
    }

    adsStore.setConsentRegion(region);
    adsStore.setStatus('ready');
    return region;
  } catch (err) {
    if (__DEV__) console.warn('[AdsService] Initialization failed:', err);
    adsStore.setStatus('failed');
    initPromise = null;
    return 'UNKNOWN';
  }
}

/**
 * Starts the SDK once. Concurrent callers (root layout, onboarding, startup) share one run.
 */
export function initializeAds(): Promise<ConsentRegion> {
  if (!initPromise) {
    initPromise = startSdk();
  }
  return initPromise;
}

type FullscreenAd = MaxSdk['InterstitialAd'];

function bindFullscreenListeners(format: 'interstitial' | 'rewarded', ad: FullscreenAd): void {
  const adKey = (adUnitId: string) => `${format}:${adUnitId}`;
  const release = (adUnitId: string) => {
    finishExternalActivity('ad');
    finishExternalActivity('ad_click');
    displayedNetworks.delete(adKey(adUnitId));
    adsStore.dismissFullScreenAd(adKey(adUnitId));
  };

  ad.addAdLoadedEventListener((info) => {
    dispatchAdEvent(format, info.adUnitId, 'loaded', info);
  });
  ad.addAdLoadFailedEventListener((error) => {
    dispatchAdEvent(format, error.adUnitId, 'load_failed', error);
  });
  ad.addAdDisplayedEventListener((info) => {
    logAdShown(format, info);
    recordExternalActivity('ad');
    displayedNetworks.set(adKey(info.adUnitId), info.networkName);
    adsStore.requestFullScreenAd(adKey(info.adUnitId));
    dispatchAdEvent(format, info.adUnitId, 'displayed', info);
  });
  ad.addAdFailedToDisplayEventListener((error) => {
    release(error.adUnitId);
    dispatchAdEvent(format, error.adUnitId, 'display_failed', error);
  });
  ad.addAdHiddenEventListener((info) => {
    release(info.adUnitId);
    dispatchAdEvent(format, info.adUnitId, 'hidden', info);
  });
  ad.addAdClickedEventListener((info) => {
    recordAdClick();
    dispatchAdEvent(format, info.adUnitId, 'clicked', info);
  });
  ad.addAdRevenuePaidListener((info) => {
    trackAdRevenue(info);
    dispatchAdEvent(format, info.adUnitId, 'revenue_paid', info);
  });
}

/**
 * MAX keeps one listener per event per format, so each is registered exactly once here and
 * routed by ad unit through ad-events (Pitfall §11.1).
 */
function registerSdkListeners(sdk: MaxSdk): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  bindFullscreenListeners('interstitial', sdk.InterstitialAd);
  bindFullscreenListeners('rewarded', sdk.RewardedAd);

  sdk.RewardedAd.addAdReceivedRewardEventListener((info) => {
    dispatchAdEvent('rewarded', info.adUnitId, 'user_rewarded', info);
  });

  sdk.addNativeUIComponentAdViewAdLoadedEventListener(() => {
    preloadedMrecReady = true;
  });
  sdk.addNativeUIComponentAdViewAdLoadFailedEventListener(() => {
    discardPreloadedMrec();
  });

  subscribeRewardedReload();

  adsStore.onStaleFullScreenAd((adKey) => {
    const format = adKey.split(':')[0];
    reportMissingHiddenEvent(format, displayedNetworks.get(adKey));
    displayedNetworks.delete(adKey);
  });
}

function scheduleRewardedRetry(): void {
  if (rewardedRetryTimer) return;
  const delay = LOAD_BACKOFF_MS[Math.min(rewardedRetryAttempt, LOAD_BACKOFF_MS.length - 1)];
  rewardedRetryAttempt += 1;
  rewardedRetryTimer = setTimeout(() => {
    rewardedRetryTimer = null;
    preloadRewarded();
  }, delay);
}

function subscribeRewardedReload(): void {
  const unit = ADS_CONFIG.units.rewarded;
  if (!unit) return;
  subscribeAdEvent('rewarded', unit, 'loaded', () => {
    rewardedRetryAttempt = 0;
  });
  subscribeAdEvent('rewarded', unit, 'load_failed', scheduleRewardedRetry);
  subscribeAdEvent('rewarded', unit, 'hidden', () => preloadRewarded());
  subscribeAdEvent('rewarded', unit, 'display_failed', () => preloadRewarded());
}

export function logAdShown(format: AdEventFormat, info: { networkName?: string }): void {
  if (__DEV__) console.log(`[Ads] displayed format=${format} network=${info.networkName}`);
}

function reportViewClick(): void {
  recordAdClick();
}

/** Revenue and click callbacks shared by every AdView / NativeAdView (§5.6, §11.8). */
export const VIEW_AD_CALLBACKS = {
  onAdRevenuePaid: (info: TrackRevenuePayload) => trackAdRevenue(info),
  onAdClicked: reportViewClick,
};

export function preloadInterstitial(unitId: string = ADS_CONFIG.units.interstitial): void {
  if (unitId) Max?.InterstitialAd.loadAd(unitId);
}

export function showInterstitial(
  unitId: string = ADS_CONFIG.units.interstitial,
  placement?: string
): void {
  if (Max) {
    Max.InterstitialAd.showAd(unitId, placement);
    return;
  }
  if (simulatedInterstitialPlayer) {
    dispatchAdEvent('interstitial', unitId, 'displayed', { adUnitId: unitId });
    void simulatedInterstitialPlayer(placement).finally(() => {
      dispatchAdEvent('interstitial', unitId, 'hidden', { adUnitId: unitId });
    });
  }
}

function discardPreloadedMrec(): void {
  const id = preloadedMrecId;
  preloadedMrecId = undefined;
  preloadedMrecReady = false;
  if (id !== undefined) {
    void Max?.destroyNativeUIComponentAdView(id).catch(() => undefined);
  }
}

/** Preloads one MREC at launch so the fill-space fallback can show at once (§5.2). */
export async function preloadMrec(unitId: string = ADS_CONFIG.units.mrec): Promise<void> {
  if (!Max || !adsInBuild() || !unitId || preloadedMrecId !== undefined) return;
  try {
    preloadedMrecId = await Max.preloadNativeUIComponentAdView(unitId, Max.AdFormat.MREC);
  } catch {
    preloadedMrecId = undefined;
  }
}

/** Hands the preloaded MREC to a slot. Pair with `releaseMrec` when the slot unmounts. */
export function takePreloadedMrec(): number | undefined {
  if (!preloadedMrecReady) return undefined;
  const id = preloadedMrecId;
  preloadedMrecId = undefined;
  preloadedMrecReady = false;
  return id;
}

export function releaseMrec(adViewId: number): void {
  void Max?.destroyNativeUIComponentAdView(adViewId).catch(() => undefined);
  void preloadMrec();
}

export function rewardedAvailable(): boolean {
  if (simulatedRewardedPlayer && !Max) return true;
  return Boolean(Max && adsInBuild() && ADS_CONFIG.units.rewarded);
}

export function preloadRewarded(unitId: string = ADS_CONFIG.units.rewarded): void {
  if (unitId && adsInBuild()) Max?.RewardedAd.loadAd(unitId);
}

export async function isRewardedReady(
  unitId: string = ADS_CONFIG.units.rewarded
): Promise<boolean> {
  if (!Max) return Boolean(simulatedRewardedPlayer);
  try {
    return await Max.RewardedAd.isAdReady(unitId);
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

function waitForRewardedLoad(unitId: string, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      unsubLoaded();
      unsubFailed();
      resolve(ready);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const unsubLoaded = subscribeAdEvent('rewarded', unitId, 'loaded', () => finish(true));
    const unsubFailed = subscribeAdEvent('rewarded', unitId, 'load_failed', () => finish(false));
    preloadRewarded(unitId);
  });
}

/** §5.5 step 1: `isAdReady` within 2 s, otherwise `loadAd` within 15 s. */
export async function ensureRewardedReady(
  unitId: string = ADS_CONFIG.units.rewarded
): Promise<boolean> {
  if (!rewardedAvailable()) return false;
  if (await withTimeout(isRewardedReady(unitId), REWARDED_READY_CHECK_MS, false)) return true;
  if (!Max) return false;
  return waitForRewardedLoad(unitId, REWARDED_LOAD_TIMEOUT_MS);
}

async function showSimulatedRewarded(options: ShowRewardedOptions): Promise<RewardedShowResult> {
  if (!simulatedRewardedPlayer) return 'failed';
  const result = await simulatedRewardedPlayer(options.placement);
  if (!result.rewarded) return 'closed';
  options.onReward?.();
  return 'rewarded';
}

/**
 * Shows a rewarded ad and resolves once the outcome is final (§5.5 steps 3 to 5):
 * - a display error, or no `displayed` within 5 s: 'failed'
 * - closed without a reward, after waiting 1.5 s for a late one: 'closed'
 */
export function showRewardedAd(
  options: ShowRewardedOptions,
  unitId: string = ADS_CONFIG.units.rewarded
): Promise<RewardedShowResult> {
  if (!Max || !adsInBuild()) {
    return showSimulatedRewarded(options);
  }
  const sdk = Max;
  const adKey = `rewarded:${unitId}`;

  return new Promise<RewardedShowResult>((resolve) => {
    let rewarded = false;
    let displayed = false;
    let settled = false;
    let displayTimer: ReturnType<typeof setTimeout> | null = null;
    let lateRewardTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribers: (() => void)[] = [];

    const settle = (result: RewardedShowResult) => {
      if (settled) return;
      settled = true;
      if (displayTimer) clearTimeout(displayTimer);
      if (lateRewardTimer) clearTimeout(lateRewardTimer);
      for (const unsubscribe of unsubscribers) unsubscribe();
      adsStore.dismissFullScreenAd(adKey);
      resolve(result);
    };

    const onClosed = () => {
      if (rewarded) {
        settle('rewarded');
        return;
      }
      if (!lateRewardTimer) {
        lateRewardTimer = setTimeout(() => settle('closed'), LATE_REWARD_WAIT_MS);
      }
    };

    unsubscribers.push(
      subscribeAdEvent('rewarded', unitId, 'displayed', () => {
        displayed = true;
        if (displayTimer) clearTimeout(displayTimer);
      }),
      subscribeAdEvent('rewarded', unitId, 'user_rewarded', () => {
        if (rewarded) return;
        rewarded = true;
        options.onReward?.();
        if (lateRewardTimer) settle('rewarded');
      }),
      subscribeAdEvent('rewarded', unitId, 'hidden', onClosed),
      subscribeAdEvent('rewarded', unitId, 'display_failed', () => settle('failed')),
      // Pitfall §11.2: the store force-clears the flag when `hidden` never arrives.
      adsStore.subscribe(() => {
        if (displayed && !adsStore.getState().fullScreenAdShowing) onClosed();
      })
    );

    displayTimer = setTimeout(() => {
      if (!displayed) settle('failed');
    }, REWARDED_DISPLAY_TIMEOUT_MS);

    adsStore.requestFullScreenAd(adKey);
    try {
      sdk.RewardedAd.showAd(unitId, options.placement, options.customData);
    } catch {
      settle('failed');
    }
  });
}

export const showPrivacyOptions = showPrivacyOptionsForm;

export function isMediationDebuggerEnabled(): boolean {
  return __DEV__;
}

export const openMediationDebugger = showMediationDebugger;

/**
 * Reopens the Google UMP / MAX consent form for GDPR users (§5.6).
 */
export async function showPrivacyOptionsForm(): Promise<boolean> {
  if (adsStore.getState().consentRegion !== 'GDPR' || !Max) {
    return false;
  }
  recordExternalActivity('permission');
  try {
    const error = await Max.default.showCmpForExistingUser();
    return !error;
  } catch {
    return false;
  } finally {
    finishExternalActivity('permission');
  }
}

/**
 * Opens the AppLovin MAX Mediation Debugger in dev/test builds only (§5.6).
 */
export function showMediationDebugger(): boolean {
  if (!isMediationDebuggerEnabled() || !Max) {
    return false;
  }
  recordExternalActivity('ad');
  Max.default.showMediationDebugger();
  setTimeout(() => finishExternalActivity('ad'), 1000);
  return true;
}

export function resetAdsServiceForTesting(): void {
  initPromise = null;
  listenersRegistered = false;
  rewardedRetryAttempt = 0;
  if (rewardedRetryTimer) clearTimeout(rewardedRetryTimer);
  rewardedRetryTimer = null;
  preloadedMrecId = undefined;
  preloadedMrecReady = false;
  displayedNetworks.clear();
}

export type { AdEventFormat };
