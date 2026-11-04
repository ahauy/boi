import { ADS_CONFIG } from './ads-config';
import { AdInfo } from './ad-events';

/**
 * Ad Revenue & Attribution Module (Playbook §5.6)
 *
 * Tracks every impression with revenue > 0 to Firebase Analytics (`ad_impression`)
 * and Adjust attribution (`trackAdRevenue('applovin_max_sdk')`).
 * Manages GDPR DMA consent status and first-purchase event tracking.
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

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

let adjustInitialized = false;

/**
 * Initializes Adjust attribution SDK after MAX consent flow completes (§5.6).
 */
export async function initializeAdjust(consentRegion: 'GDPR' | 'OTHER' | 'UNKNOWN'): Promise<void> {
  if (adjustInitialized) return;

  const appToken = ADS_CONFIG.adjust.appToken;
  if (!appToken) {
    if (isDev) console.log('[Adjust] Skipped: no app token configured');
    return;
  }

  const isGdprOrUnknown = consentRegion === 'GDPR' || consentRegion === 'UNKNOWN';

  try {
    // Dynamically attempt to load Adjust native module if present in build
    const AdjustPackage = await safeRequire('react-native-adjust');
    if (AdjustPackage?.Adjust && AdjustPackage?.AdjustConfig) {
      const { Adjust, AdjustConfig } = AdjustPackage;
      const env =
        ADS_CONFIG.adjust.environment === 'production'
          ? AdjustConfig.EnvironmentProduction
          : AdjustConfig.EnvironmentSandbox;

      const config = new AdjustConfig(appToken, env);

      if (isGdprOrUnknown) {
        // Playbook §5.6: Third-party sharing off, DMA eea=1, no personalization
        try {
          if (typeof Adjust.trackThirdPartySharing === 'function' && AdjustPackage.AdjustThirdPartySharing) {
            const sharing = new AdjustPackage.AdjustThirdPartySharing(false);
            sharing.addGranularOption('google_dma', 'eea', '1');
            sharing.addGranularOption('google_dma', 'ad_personalization', '0');
            sharing.addGranularOption('google_dma', 'ad_user_data', '0');
            Adjust.trackThirdPartySharing(sharing);
          }
        } catch (e) {
          if (isDev) console.warn('[Adjust] Consent granular option note:', e);
        }
      }

      Adjust.initSdk(config);
      adjustInitialized = true;
      if (isDev) console.log('[Adjust] Initialized successfully');
    } else {
      if (isDev) console.log('[Adjust] Native module not bundled (Expo Go / mock environment)');
      adjustInitialized = true;
    }
  } catch (err) {
    if (isDev) console.warn('[Adjust] Init failed:', err);
  }
}

/**
 * Records impression revenue to Firebase and Adjust (§5.6).
 * Ignores revenue <= 0, NaN, or non-finite values (MAX sends -1 when unknown).
 */
export function trackAdRevenue(info: AdInfo | TrackRevenuePayload): void {
  const rev = info.revenue;
  if (typeof rev !== 'number' || !Number.isFinite(rev) || rev <= 0) {
    return;
  }

  const payload = {
    ad_platform: 'appLovin',
    ad_source: info.networkName ?? 'unknown',
    ad_format: info.adFormat ?? 'unknown',
    ad_unit_name: info.adUnitId,
    value: rev,
    currency: 'USD',
  };

  // 1. Firebase Analytics `ad_impression`
  sendToFirebaseAnalytics('ad_impression', payload);

  // 2. Adjust trackAdRevenue
  sendToAdjustRevenue(rev, info.networkName);
}

/**
 * Tracks first subscription purchase to Adjust with paid price and order ID (§5.6).
 * Never called on trial start.
 */
export function trackFirstPurchase(purchase: FirstPurchasePayload): void {
  const token = ADS_CONFIG.adjust.purchaseEventToken;
  if (!token) return;

  try {
    const AdjustPackage = safeRequireSync('react-native-adjust');
    if (AdjustPackage?.Adjust && AdjustPackage?.AdjustEvent) {
      const event = new AdjustPackage.AdjustEvent(token);
      event.setRevenue(purchase.price, purchase.currency || 'USD');
      if (purchase.orderId) {
        event.setOrderId(purchase.orderId);
      }
      AdjustPackage.Adjust.trackEvent(event);
      if (isDev) console.log('[Adjust] Tracked first purchase event:', purchase.orderId);
    }
  } catch (err) {
    if (isDev) console.warn('[Adjust] Purchase event failed:', err);
  }
}

// Helpers for safe native dispatch
function sendToFirebaseAnalytics(eventName: string, params: Record<string, unknown>): void {
  try {
    const firebase = safeRequireSync('@react-native-firebase/analytics');
    if (typeof firebase?.default === 'function') {
      firebase.default().logEvent(eventName, params);
      return;
    }
  } catch {
    // Non-native / development fallback
  }

  if (isDev) {
    console.log(`[Firebase Mock] Event "${eventName}":`, params);
  }
}

function sendToAdjustRevenue(revenue: number, networkName?: string): void {
  try {
    const AdjustPackage = safeRequireSync('react-native-adjust');
    if (AdjustPackage?.Adjust && AdjustPackage?.AdjustAppStoreSubscription) {
      const adRevenue = new AdjustPackage.AdjustAdRevenue('applovin_max_sdk');
      adRevenue.setRevenue(revenue, 'USD');
      if (networkName) {
        adRevenue.setAdRevenueNetwork(networkName);
      }
      AdjustPackage.Adjust.trackAdRevenue(adRevenue);
      return;
    }
  } catch {
    // Fallback
  }

  if (isDev) {
    console.log(`[Adjust Mock] Ad revenue tracked: $${revenue} (network: ${networkName ?? 'unknown'})`);
  }
}

async function safeRequire(pkgName: string): Promise<any> {
  return safeRequireSync(pkgName);
}

function safeRequireSync(pkgName: string): any {
  // In Metro runtime (`globalThis.__r`), calling `require(pkgName)` with an unbundled string module ID
  // triggers `ErrorUtils.reportFatalError` (RedBox) inside `@expo/cli/build/metro-require/require.js`
  // even inside a try/catch block.
  const injected = (globalThis as any).__PALMSIGHT_NATIVE_MODULES__?.[pkgName];
  if (injected) return injected;
  if (typeof (globalThis as any).__r === 'function') {
    return null;
  }
  try {
    const dynamicRequire = typeof require === 'function' ? require : null;
    return dynamicRequire ? dynamicRequire(pkgName) : null;
  } catch {
    return null;
  }
}
