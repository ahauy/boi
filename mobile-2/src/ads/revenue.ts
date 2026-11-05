import type * as AdjustModule from 'react-native-adjust';
import type * as AnalyticsModule from '@react-native-firebase/analytics';
import type * as CrashlyticsModule from '@react-native-firebase/crashlytics';
import { ADS_CONFIG } from './ads-config';
import { adsStore, type ConsentRegion } from './ads-store';

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

let adjustInitialized = false;
let analyticsOverride: typeof AnalyticsModule | null = null;

let adjustOverride: typeof AdjustModule | null = null;
let crashlyticsOverride: typeof CrashlyticsModule | null = null;

export function setAnalyticsSdkForTesting(sdk: typeof AnalyticsModule | null): void {
  analyticsOverride = sdk;
}

export function setAdjustSdkForTesting(sdk: typeof AdjustModule | null): void {
  adjustOverride = sdk;
}

export function setCrashlyticsSdkForTesting(sdk: typeof CrashlyticsModule | null): void {
  crashlyticsOverride = sdk;
}

/**
 * The single gate for third-party measurement (privacy policy section 5): Adjust events,
 * Firebase Analytics and Crashlytics. Only a region known to be outside GDPR scope allows it.
 * Until the region is known (UNKNOWN) it stays off. Billing verification does not use this gate.
 * Known limit: an EEA user who consented through the UMP form is still treated as GDPR here,
 * because the app does not read the real consent result.
 */
export function measurementAllowed(region: ConsentRegion = adsStore.getState().consentRegion): boolean {
  return region === 'OTHER';
}

/** Pushes the measurement decision to Firebase collection switches (both directions). */
export function applyMeasurementConsent(region: ConsentRegion = adsStore.getState().consentRegion): void {
  const enabled = measurementAllowed(region);
  try {
    const analytics = loadAnalytics();
    void analytics?.setAnalyticsCollectionEnabled(analytics.getAnalytics(), enabled)?.catch?.(() => undefined);
  } catch (err) {
    if (__DEV__) console.warn('[Firebase] Analytics collection switch failed:', err);
  }
  try {
    const crashlytics = loadCrashlytics();
    void crashlytics
      ?.setCrashlyticsCollectionEnabled(crashlytics.getCrashlytics(), enabled)
      ?.catch?.(() => undefined);
  } catch (err) {
    if (__DEV__) console.warn('[Crashlytics] Collection switch failed:', err);
  }
}

function loadAdjust(): typeof AdjustModule | null {
  if (adjustOverride) return adjustOverride;
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
  if (crashlyticsOverride) return crashlyticsOverride;
  try {
    return require('@react-native-firebase/crashlytics') as typeof CrashlyticsModule;
  } catch {
    return null;
  }
}

/**
 * Starts Adjust after the MAX consent flow (§5.6), only when the region is known to be outside
 * GDPR scope (`measurementAllowed`). GDPR or unknown region: Adjust is not started at all, so it
 * sends nothing, not even basic install data. If the consent wait times out (UNKNOWN) there is
 * no Adjust for that session; `adjustInitialized` stays false and every Adjust event is dropped.
 */
export async function initializeAdjust(consentRegion: ConsentRegion): Promise<void> {
  applyMeasurementConsent(consentRegion);
  if (!measurementAllowed(consentRegion)) return;
  const appToken = ADS_CONFIG.adjust.appToken;
  if (adjustInitialized || !appToken) return;

  const sdk = loadAdjust();
  if (!sdk) return;

  try {
    const { Adjust, AdjustConfig } = sdk;
    const environment =
      ADS_CONFIG.adjust.environment === 'production'
        ? AdjustConfig.EnvironmentProduction
        : AdjustConfig.EnvironmentSandbox;
    const config = new AdjustConfig(appToken, environment);

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
  if (!measurementAllowed()) return;

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

function adjustSdkIfAllowed(): typeof AdjustModule | null {
  if (!adjustInitialized || !measurementAllowed()) return null;
  return loadAdjust();
}

function sendToAdjustRevenue(revenue: number, networkName?: string): void {
  const sdk = adjustSdkIfAllowed();
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
  const sdk = adjustSdkIfAllowed();
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

/** Crashlytics non-fatal for an ad that never reported `hidden`: format and network only (§8). */
export function reportMissingHiddenEvent(format: string, networkName?: string): void {
  if (!measurementAllowed()) return;
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
