import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Global Ads Store (Playbook §2.1, §11.2, §11.3)
 *
 * Pitfall 2: Missing hidden events.
 * Some ad network adapters never report close, or Android kills the ad activity on relaunch.
 * Treat the ad as closed 1s after the app becomes active again; otherwise fullScreenAdShowing
 * stays on and banners, interstitials, rewarded and paywall all disappear for the session.
 *
 * Pitfall 3: Full-screen flag must be recomputed from all open/requested ads, not set/cleared per flow.
 */

export type AdSdkStatus = 'uninitialized' | 'initializing' | 'ready' | 'failed';
export type ConsentRegion = 'GDPR' | 'OTHER' | 'UNKNOWN';

export interface AdsStoreState {
  status: AdSdkStatus;
  consentRegion: ConsentRegion;
  fullScreenAdShowing: boolean;
  nativeAdsOnScreen: number;
  bannerVisible: boolean;
  /** Adaptive height of the root banner, known once the SDK is ready. */
  bannerHeight: number;
}

let status: AdSdkStatus = 'uninitialized';
let consentRegion: ConsentRegion = 'UNKNOWN';
const activeFullScreenAds = new Set<string>();
let nativeAdsOnScreen = 0;
let bannerVisible = false;
export const DEFAULT_BANNER_HEIGHT = 50;
let bannerHeight = DEFAULT_BANNER_HEIGHT;

const listeners = new Set<() => void>();
let staleAdListener: ((adKey: string) => void) | null = null;
let appStateTimer: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      if (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production') {
        console.warn('[AdsStore] Listener error:', err);
      }
    }
  }
}

/**
 * Handle AppState changes (Pitfall §11.2).
 * 1s after returning to active, if no explicit ad close was received,
 * force-clear full-screen active set to prevent locking the app forever.
 */
function handleAppStateChange(nextState: AppStateStatus): void {
  if (nextState === 'active') {
    if (appStateTimer) clearTimeout(appStateTimer);
    appStateTimer = setTimeout(() => {
      if (activeFullScreenAds.size > 0) {
        for (const adKey of activeFullScreenAds) {
          staleAdListener?.(adKey);
        }
        activeFullScreenAds.clear();
        notify();
      }
    }, 1000);
  } else if (appStateTimer) {
    clearTimeout(appStateTimer);
    appStateTimer = null;
  }
}

// Bind AppState listener
try {
  AppState.addEventListener('change', handleAppStateChange);
} catch {
  // Graceful fallback for non-native / test environments
}

export const adsStore = {
  getState(): AdsStoreState {
    return {
      status,
      consentRegion,
      fullScreenAdShowing: activeFullScreenAds.size > 0,
      nativeAdsOnScreen,
      bannerVisible,
      bannerHeight,
    };
  },

  setBannerVisible(visible: boolean): void {
    if (bannerVisible !== visible) {
      bannerVisible = visible;
      notify();
    }
  },

  setBannerHeight(height: number): void {
    if (height > 0 && bannerHeight !== height) {
      bannerHeight = height;
      notify();
    }
  },

  setStatus(nextStatus: AdSdkStatus): void {
    if (status !== nextStatus) {
      status = nextStatus;
      notify();
    }
  },

  setConsentRegion(region: ConsentRegion): void {
    if (consentRegion !== region) {
      consentRegion = region;
      notify();
    }
  },

  /**
   * Mark a full-screen ad as active/requested (Pitfall §11.3).
   */
  requestFullScreenAd(adKey: string): void {
    if (appStateTimer) {
      clearTimeout(appStateTimer);
      appStateTimer = null;
    }
    const before = activeFullScreenAds.size;
    activeFullScreenAds.add(adKey);
    if (before === 0) {
      notify();
    }
  },

  /**
   * Mark a full-screen ad as dismissed/hidden or failed.
   */
  dismissFullScreenAd(adKey: string): void {
    const deleted = activeFullScreenAds.delete(adKey);
    if (deleted && activeFullScreenAds.size === 0) {
      notify();
    }
  },

  /**
   * Reset all full-screen ads explicitly.
   */
  clearFullScreenAds(): void {
    if (activeFullScreenAds.size > 0) {
      activeFullScreenAds.clear();
      notify();
    }
  },

  /**
   * Increment number of active native ads currently rendered on screen.
   */
  registerNativeAd(): () => void {
    nativeAdsOnScreen += 1;
    notify();
    return () => {
      nativeAdsOnScreen = Math.max(0, nativeAdsOnScreen - 1);
      notify();
    };
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Called for each ad that was treated as closed because `hidden` never arrived. */
  onStaleFullScreenAd(listener: (adKey: string) => void): void {
    staleAdListener = listener;
  },

  reset(): void {
    status = 'uninitialized';
    consentRegion = 'UNKNOWN';
    activeFullScreenAds.clear();
    nativeAdsOnScreen = 0;
    bannerVisible = false;
    bannerHeight = DEFAULT_BANNER_HEIGHT;
    staleAdListener = null;
    if (appStateTimer) clearTimeout(appStateTimer);
    appStateTimer = null;
    notify();
  },
};

export function useAdsStore(): AdsStoreState {
  const [state, setState] = useState<AdsStoreState>(adsStore.getState());

  useEffect(() => {
    return adsStore.subscribe(() => {
      setState(adsStore.getState());
    });
  }, []);

  return state;
}
