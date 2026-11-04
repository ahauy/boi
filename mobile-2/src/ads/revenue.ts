import type * as AdjustModule from 'react-native-adjust';
import type * as AnalyticsModule from '@react-native-firebase/analytics';
import type * as CrashlyticsModule from '@react-native-firebase/crashlytics';
import { ADS_CONFIG } from './ads-config';

/**
 * Ad Revenue & Attribution Module (Playbook §5.6, §8)
 *
 * Tracks every impression with revenue > 0 to Firebase Analytics (`ad_impression`) and Adjust
 * (`trackAdRevenue('applovin_max_sdk')`). Manages DMA consent and the first-purchase event.
 * Each SDK is optional at runtime: Expo Go has none of them, and Firebase needs
 * `google-services.json`, so a missing one disables only its own signal.
 */

export interface TrackRevenuePayload {
  adUnitId: string;
  adFormat?: string;
  networkName?: string;
  revenue?: number;
}

export interface FirstPurchasePayload {
  price: number;
  currency: string;
  orderId: string;
}

export interface AttributionIds {
  adjustAdid: string | null;
  gaid: string | null;
}

const ATTRIBUTION_ID_TIMEOUT_MS = 2_000;

let adjustInitialized = false;
let analyticsOverride: typeof AnalyticsModule | null = null;

export function setAnalyticsSdkForTesting(sdk: typeof AnalyticsModule | null): void {
  analyticsOverride = sdk;
}

function loadAdjust(): typeof AdjustModule | null {
  try {
    return require('react-native-adjust') as typeof AdjustModule;
  } catch {
    return null;
  }
}

function loadAnalytics(): typeof AnalyticsModule | null {
  if (analyticsOverride) return analyticsOverride;
  try {
    return require('@react-native-firebase/analytics') as typeof AnalyticsModule;
  } catch {
    return null;
  }
}

function loadCrashlytics(): typeof CrashlyticsModule | null {
  try {
    return require('@react-native-firebase/crashlytics') as typeof CrashlyticsModule;
  } catch {
    return null;
  }
}

/**
 * Starts Adjust after the MAX consent flow (§5.6). GDPR or unknown region: third-party sharing
 * off, Google DMA `eea=1`, no ad personalization, no GAID read.
 */
export async function initializeAdjust(consentRegion: 'GDPR' | 'OTHER' | 'UNKNOWN'): Promise<void> {
  const appToken = ADS_CONFIG.adjust.appToken;
  if (adjustInitialized || !appToken) return;

  const sdk = loadAdjust();
  if (!sdk) return;

  try {
    const { Adjust, AdjustConfig, AdjustThirdPartySharing } = sdk;
    const environment =
      ADS_CONFIG.adjust.environment === 'production'
        ? AdjustConfig.EnvironmentProduction
        : AdjustConfig.EnvironmentSandbox;
    const config = new AdjustConfig(appToken, environment);

    if (consentRegion !== 'OTHER') {
      config.disableGoogleAdIdReading();

      const sharing = new AdjustThirdPartySharing(false);
      sharing.addGranularOption('google_dma', 'eea', '1');
      sharing.addGranularOption('google_dma', 'ad_personalization', '0');
      sharing.addGranularOption('google_dma', 'ad_user_data', '0');
      Adjust.trackThirdPartySharing(sharing);
    }

    Adjust.initSdk(config);
    adjustInitialized = true;
  } catch (err) {
    if (__DEV__) console.warn('[Adjust] Init failed:', err);
  }
}

/**
 * Records impression revenue to Firebase and Adjust (§5.6).
 * Ignores revenue <= 0, NaN, or non-finite values (MAX sends -1 when unknown).
 */
export function trackAdRevenue(info: TrackRevenuePayload): void {
  const revenue = info.revenue;
  if (typeof revenue !== 'number' || !Number.isFinite(revenue) || revenue <= 0) {
    return;
  }

  sendToFirebaseAnalytics({
    ad_platform: 'appLovin',
    ad_source: info.networkName ?? 'unknown',
    ad_format: info.adFormat ?? 'unknown',
    ad_unit_name: info.adUnitId,
    value: revenue,
    currency: 'USD',
  });
  sendToAdjustRevenue(revenue, info.networkName);
}

function sendToFirebaseAnalytics(params: Record<string, string | number>): void {
  const sdk = loadAnalytics();
  if (!sdk) return;
  try {
    sdk.logEvent(sdk.getAnalytics(), 'ad_impression', params);
  } catch (err) {
    if (__DEV__) console.warn('[Firebase] ad_impression failed:', err);
  }
}

function sendToAdjustRevenue(revenue: number, networkName?: string): void {
  const sdk = adjustInitialized ? loadAdjust() : null;
  if (!sdk) return;
  try {
    const adRevenue = new sdk.AdjustAdRevenue('applovin_max_sdk');
    adRevenue.setRevenue(revenue, 'USD');
    if (networkName) {
      adRevenue.setAdRevenueNetwork(networkName);
    }
    sdk.Adjust.trackAdRevenue(adRevenue);
  } catch (err) {
    if (__DEV__) console.warn('[Adjust] Ad revenue failed:', err);
  }
}

/**
 * First subscription purchase to Adjust with the paid price and order ID (§5.6).
 * Never called at trial start.
 */
export function trackFirstPurchase(purchase: FirstPurchasePayload): void {
  const token = ADS_CONFIG.adjust.purchaseEventToken;
  const sdk = adjustInitialized ? loadAdjust() : null;
  if (!token || !sdk) return;

  try {
    const event = new sdk.AdjustEvent(token);
    event.setRevenue(purchase.price, purchase.currency || 'USD');
    if (purchase.orderId) {
      event.setDeduplicationId(purchase.orderId);
    }
    sdk.Adjust.trackEvent(event);
  } catch (err) {
    if (__DEV__) console.warn('[Adjust] Purchase event failed:', err);
  }
}

function readId(read: (done: (id: string | null) => void) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ATTRIBUTION_ID_TIMEOUT_MS);
    try {
      read((id) => {
        clearTimeout(timer);
        resolve(id || null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Adjust ADID and GAID for `/billing/verify`, only where consent allows them (§5.6, §6.5). */
export async function getAttributionIds(
  consentRegion: 'GDPR' | 'OTHER' | 'UNKNOWN'
): Promise<AttributionIds> {
  const sdk = adjustInitialized ? loadAdjust() : null;
  if (!sdk || consentRegion !== 'OTHER') {
    return { adjustAdid: null, gaid: null };
  }
  const { Adjust } = sdk;
  const [adjustAdid, gaid] = await Promise.all([
    readId((done) => Adjust.getAdidWithTimeout(ATTRIBUTION_ID_TIMEOUT_MS, done)),
    readId((done) => Adjust.getGoogleAdId(done)),
  ]);
  return { adjustAdid, gaid };
}

/** Crashlytics non-fatal for an ad that never reported `hidden`: format and network only (§8). */
export function reportMissingHiddenEvent(format: string, networkName?: string): void {
  const sdk = loadCrashlytics();
  if (!sdk) return;
  try {
    sdk.recordError(
      sdk.getCrashlytics(),
      new Error(`Ad never reported hidden: ${format} / ${networkName ?? 'unknown'}`)
    );
  } catch (err) {
    if (__DEV__) console.warn('[Crashlytics] Non-fatal failed:', err);
  }
}

export function resetRevenueForTesting(): void {
  adjustInitialized = false;
}
