import { ADS_CONFIG, adsInBuild } from './ads-config';
import { dispatchAdEvent, subscribeAdEvent, AdInfo, AdError, AdRewardItem } from './ad-events';
import { adsStore, ConsentRegion } from './ads-store';
import { trackAdRevenue } from './revenue';
import { recordExternalActivity, finishExternalActivity } from '../lib/external-activity';

/**
 * Ads Service (Playbook §2.1, §3, §5.1, §5.2, §5.4, §5.5, §11)
 *
 * THE ONLY FILE THAT IMPORTS / INTERFACES WITH THE AD SDK.
 * Handles AppLovin MAX SDK lifecycle, Google UMP consent flow,
 * and safe wrappers for full-screen and format loading.
 */

// Safe dynamic accessor to AppLovin MAX SDK (avoids Metro `require.js` RedBox in Expo Go)
let AppLovinMAX: any = (globalThis as any).__PALMSIGHT_NATIVE_MODULES__?.['react-native-applovin-max'] ?? null;
if (!AppLovinMAX && typeof (globalThis as any).__r !== 'function') {
  try {
    const dynamicRequire = typeof require === 'function' ? require : null;
    AppLovinMAX = dynamicRequire ? dynamicRequire('react-native-applovin-max') : null;
  } catch {
    AppLovinMAX = null;
  }
}

let sdkInitialized = false;
let globalListenersRegistered = false;

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

export async function initializeAds(): Promise<ConsentRegion> {
  if (sdkInitialized) {
    return adsStore.getState().consentRegion;
  }

  if (!adsInBuild() || !AppLovinMAX) {
    if (__DEV__) {
      console.log('[AdsService] Ads not available in this build/environment (mock fallback active)');
    }
    adsStore.setStatus('ready');
    adsStore.setConsentRegion('OTHER');
    sdkInitialized = true;
    return 'OTHER';
  }

  adsStore.setStatus('initializing');

  try {
    registerGlobalSdkListeners();

    // 1. Configure Consent Flow (Google UMP via MAX Terms and Privacy flow) (§3)
    if (AppLovinMAX.setTermsAndPrivacyPolicyFlowEnabled) {
      AppLovinMAX.setTermsAndPrivacyPolicyFlowEnabled(true);
      AppLovinMAX.setPrivacyPolicyUrl(ADS_CONFIG.urls.privacy);
      AppLovinMAX.setTermsOfServiceUrl(ADS_CONFIG.urls.terms);
    }

    // Never send user identifiers (§5.1) - do NOT call setUserId

    // Test device registration in sandbox builds
    if (ADS_CONFIG.testDeviceIds.length > 0 && AppLovinMAX.setTestDeviceAdvertisingIds) {
      AppLovinMAX.setTestDeviceAdvertisingIds(ADS_CONFIG.testDeviceIds);
    }

    // 2. Initialize MAX SDK with SDK Key
    const initConfig = await new Promise<any>((resolve) => {
      AppLovinMAX.initialize(ADS_CONFIG.appLovinSdkKey, (configuration: any) => {
        resolve(configuration);
      });
    });

    sdkInitialized = true;
    adsStore.setStatus('ready');

    let region: ConsentRegion = 'OTHER';
    if (initConfig?.consentDialogState === 'APPLIES' || initConfig?.isUserInGdpr) {
      region = 'GDPR';
    }
    adsStore.setConsentRegion(region);

    if (__DEV__) {
      console.log('[AdsService] AppLovin MAX initialized successfully. Region:', region);
    }

    return region;
  } catch (err) {
    if (__DEV__) {
      console.warn('[AdsService] Initialization failed:', err);
    }
    adsStore.setStatus('failed');
    return 'UNKNOWN';
  }
}

/**
 * Register global SDK listeners ONCE and dispatch via AdEvents (Pitfall §11.1).
 */
function registerGlobalSdkListeners(): void {
  if (globalListenersRegistered || !AppLovinMAX) return;
  globalListenersRegistered = true;

  // Interstitial listeners
  AppLovinMAX.addEventListener('OnInterstitialLoadedEvent', (adInfo: AdInfo) => {
    dispatchAdEvent('interstitial', adInfo.adUnitId, 'loaded', adInfo);
  });
  AppLovinMAX.addEventListener('OnInterstitialLoadFailedEvent', (error: AdError) => {
    dispatchAdEvent('interstitial', ADS_CONFIG.units.interstitial, 'load_failed', error);
  });
  AppLovinMAX.addEventListener('OnInterstitialDisplayedEvent', (adInfo: AdInfo) => {
    recordExternalActivity('ad');
    adsStore.requestFullScreenAd(`interstitial:${adInfo.adUnitId}`);
    dispatchAdEvent('interstitial', adInfo.adUnitId, 'displayed', adInfo);
  });
  AppLovinMAX.addEventListener('OnInterstitialAdFailedToDisplayEvent', (adInfo: AdInfo, error: AdError) => {
    finishExternalActivity('ad');
    adsStore.dismissFullScreenAd(`interstitial:${adInfo.adUnitId}`);
    dispatchAdEvent('interstitial', adInfo.adUnitId, 'display_failed', adInfo, error);
  });
  AppLovinMAX.addEventListener('OnInterstitialHiddenEvent', (adInfo: AdInfo) => {
    finishExternalActivity('ad');
    adsStore.dismissFullScreenAd(`interstitial:${adInfo.adUnitId}`);
    dispatchAdEvent('interstitial', adInfo.adUnitId, 'hidden', adInfo);
  });
  AppLovinMAX.addEventListener('OnInterstitialClickedEvent', (adInfo: AdInfo) => {
    recordExternalActivity('ad_click');
    dispatchAdEvent('interstitial', adInfo.adUnitId, 'clicked', adInfo);
  });
  AppLovinMAX.addEventListener('OnInterstitialAdRevenuePaid', (adInfo: AdInfo) => {
    trackAdRevenue(adInfo);
    dispatchAdEvent('interstitial', adInfo.adUnitId, 'revenue_paid', adInfo);
  });

  // Rewarded listeners
  AppLovinMAX.addEventListener('OnRewardedAdLoadedEvent', (adInfo: AdInfo) => {
    dispatchAdEvent('rewarded', adInfo.adUnitId, 'loaded', adInfo);
  });
  AppLovinMAX.addEventListener('OnRewardedAdLoadFailedEvent', (error: AdError) => {
    dispatchAdEvent('rewarded', ADS_CONFIG.units.rewarded, 'load_failed', error);
  });
  AppLovinMAX.addEventListener('OnRewardedAdDisplayedEvent', (adInfo: AdInfo) => {
    recordExternalActivity('ad');
    adsStore.requestFullScreenAd(`rewarded:${adInfo.adUnitId}`);
    dispatchAdEvent('rewarded', adInfo.adUnitId, 'displayed', adInfo);
  });
  AppLovinMAX.addEventListener('OnRewardedAdFailedToDisplayEvent', (adInfo: AdInfo, error: AdError) => {
    finishExternalActivity('ad');
    adsStore.dismissFullScreenAd(`rewarded:${adInfo.adUnitId}`);
    dispatchAdEvent('rewarded', adInfo.adUnitId, 'display_failed', adInfo, error);
  });
  AppLovinMAX.addEventListener('OnRewardedAdHiddenEvent', (adInfo: AdInfo) => {
    finishExternalActivity('ad');
    adsStore.dismissFullScreenAd(`rewarded:${adInfo.adUnitId}`);
    dispatchAdEvent('rewarded', adInfo.adUnitId, 'hidden', adInfo);
  });
  AppLovinMAX.addEventListener('OnRewardedAdClickedEvent', (adInfo: AdInfo) => {
    recordExternalActivity('ad_click');
    dispatchAdEvent('rewarded', adInfo.adUnitId, 'clicked', adInfo);
  });
  AppLovinMAX.addEventListener('OnRewardedAdReceivedRewardEvent', (adInfo: AdInfo, reward: AdRewardItem) => {
    dispatchAdEvent('rewarded', adInfo.adUnitId, 'user_rewarded', adInfo, reward);
  });
  AppLovinMAX.addEventListener('OnRewardedAdRevenuePaid', (adInfo: AdInfo) => {
    trackAdRevenue(adInfo);
    dispatchAdEvent('rewarded', adInfo.adUnitId, 'revenue_paid', adInfo);
  });

  // Banner listeners
  AppLovinMAX.addEventListener('OnBannerAdLoadedEvent', (adInfo: AdInfo) => {
    dispatchAdEvent('banner', adInfo.adUnitId, 'loaded', adInfo);
  });
  AppLovinMAX.addEventListener('OnBannerAdLoadFailedEvent', (error: AdError) => {
    dispatchAdEvent('banner', ADS_CONFIG.units.banner, 'load_failed', error);
  });
  AppLovinMAX.addEventListener('OnBannerAdRevenuePaid', (adInfo: AdInfo) => {
    trackAdRevenue(adInfo);
    dispatchAdEvent('banner', adInfo.adUnitId, 'revenue_paid', adInfo);
  });

  // MREC listeners
  AppLovinMAX.addEventListener('OnMRecAdLoadedEvent', (adInfo: AdInfo) => {
    dispatchAdEvent('mrec', adInfo.adUnitId, 'loaded', adInfo);
  });
  AppLovinMAX.addEventListener('OnMRecAdLoadFailedEvent', (error: AdError) => {
    dispatchAdEvent('mrec', ADS_CONFIG.units.mrec, 'load_failed', error);
  });
  AppLovinMAX.addEventListener('OnMRecAdRevenuePaid', (adInfo: AdInfo) => {
    trackAdRevenue(adInfo);
    dispatchAdEvent('mrec', adInfo.adUnitId, 'revenue_paid', adInfo);
  });
}

/**
 * Preload interstitial ad (§5.4)
 */
export function preloadInterstitial(unitId: string = ADS_CONFIG.units.interstitial): void {
  if (AppLovinMAX?.loadInterstitial) {
    AppLovinMAX.loadInterstitial(unitId);
  }
}

/**
 * Preload MREC fallback unit (§5.2)
 */
export function preloadMrec(unitId: string = ADS_CONFIG.units.mrec): void {
  if (AppLovinMAX?.loadMRec) {
    AppLovinMAX.loadMRec(unitId);
  }
}

/**
 * Checks whether an interstitial is loaded and ready to show.
 */
export async function isInterstitialReady(unitId: string = ADS_CONFIG.units.interstitial): Promise<boolean> {
  if (!AppLovinMAX?.isInterstitialReady) {
    return Boolean(simulatedInterstitialPlayer);
  }
  try {
    return Boolean(await AppLovinMAX.isInterstitialReady(unitId));
  } catch {
    return false;
  }
}

/**
 * Shows an interstitial ad.
 */
export function showInterstitial(unitId: string = ADS_CONFIG.units.interstitial, placement?: string): void {
  if (AppLovinMAX?.showInterstitial) {
    AppLovinMAX.showInterstitial(unitId, placement);
    return;
  }
  if (simulatedInterstitialPlayer) {
    dispatchAdEvent('interstitial', unitId, 'displayed', { adUnitId: unitId });
    void simulatedInterstitialPlayer(placement).finally(() => {
      dispatchAdEvent('interstitial', unitId, 'hidden', { adUnitId: unitId });
    });
  }
}

/**
 * Preload rewarded ad (§5.5)
 */
export function preloadRewarded(unitId: string = ADS_CONFIG.units.rewarded): void {
  if (AppLovinMAX?.loadRewardedAd) {
    AppLovinMAX.loadRewardedAd(unitId);
  }
}

/**
 * Checks whether rewarded ad is ready.
 */
export async function isRewardedReady(unitId: string = ADS_CONFIG.units.rewarded): Promise<boolean> {
  if (!AppLovinMAX?.isRewardedAdReady) {
    return simulatedRewardedPlayer ? true : false;
  }
  try {
    return Boolean(await AppLovinMAX.isRewardedAdReady(unitId));
  } catch {
    return false;
  }
}

/**
 * Shows a rewarded ad.
 */
export function showRewarded(
  unitId: string = ADS_CONFIG.units.rewarded,
  placement?: string,
  customData?: string
): void {
  if (AppLovinMAX?.showRewardedAd) {
    AppLovinMAX.showRewardedAd(unitId, placement, customData);
  }
}

export function isMaxRewardedReady(unitId: string = ADS_CONFIG.units.rewarded): Promise<boolean> {
  return isRewardedReady(unitId);
}

export function showMaxRewarded(
  placement?: string,
  unitId: string = ADS_CONFIG.units.rewarded
): Promise<{ rewarded: boolean; completed: boolean }> {
  if (!adsInBuild() || !AppLovinMAX) {
    if (simulatedRewardedPlayer) {
      return simulatedRewardedPlayer(placement);
    }
    // In unit test environment without native MAX or UI host
    return Promise.resolve({ rewarded: true, completed: true });
  }

  return new Promise<{ rewarded: boolean; completed: boolean }>((resolve) => {
    let rewarded = false;
    let unsubReward: (() => void) | null = null;
    let unsubHidden: (() => void) | null = null;
    let unsubFailed: (() => void) | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      unsubReward?.();
      unsubHidden?.();
      unsubFailed?.();
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };

    unsubReward = subscribeAdEvent('rewarded', unitId, 'user_rewarded', () => {
      rewarded = true;
    });

    unsubHidden = subscribeAdEvent('rewarded', unitId, 'hidden', () => {
      cleanup();
      resolve({ rewarded, completed: rewarded });
    });

    unsubFailed = subscribeAdEvent('rewarded', unitId, 'display_failed', () => {
      cleanup();
      resolve({ rewarded: false, completed: false });
    });

    // 60s fallback timeout in case hidden never fires (Pitfall §11.2)
    timeoutTimer = setTimeout(() => {
      cleanup();
      resolve({ rewarded, completed: rewarded });
    }, 60_000);

    try {
      showRewarded(unitId, placement);
    } catch {
      cleanup();
      resolve({ rewarded: false, completed: false });
    }
  });
}

export const showPrivacyOptions = showPrivacyOptionsForm;

export function isMediationDebuggerEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
}

export const openMediationDebugger = showMediationDebugger;

/**
 * Reopens the Google UMP / MAX consent form for GDPR users (§5.6).
 */
export async function showPrivacyOptionsForm(): Promise<boolean> {
  if (adsStore.getState().consentRegion !== 'GDPR') {
    return false;
  }
  recordExternalActivity('permission');
  try {
    if (AppLovinMAX?.showCmpForExistingUser) {
      await AppLovinMAX.showCmpForExistingUser();
      return true;
    }
    return false;
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
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  if (!isDev) {
    return false;
  }
  if (AppLovinMAX?.showMediationDebugger) {
    recordExternalActivity('ad');
    AppLovinMAX.showMediationDebugger();
    setTimeout(() => finishExternalActivity('ad'), 1000);
    return true;
  }
  return false;
}

export function getAppLovinMaxRaw(): any {
  return AppLovinMAX;
}
