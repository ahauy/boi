import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADS_CONFIG } from './ads-config';
import { adsStore, type ConsentRegion } from './ads-store';
import {
  applyMeasurementConsent,
  initializeAdjust,
  measurementAllowed,
  reportMissingHiddenEvent,
  resetRevenueForTesting,
  setAdjustSdkForTesting,
  setAnalyticsSdkForTesting,
  setCrashlyticsSdkForTesting,
  trackAdRevenue,
  trackFirstPurchase,
} from './revenue';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));

const logEvent = vi.fn();
const setAnalyticsCollectionEnabled = vi.fn(async () => undefined);
const recordError = vi.fn();
const setCrashlyticsCollectionEnabled = vi.fn(async () => null);
const initSdk = vi.fn();
const trackAdRevenueNative = vi.fn();
const trackEvent = vi.fn();
const trackThirdPartySharing = vi.fn();

class FakeConfig {
  static EnvironmentProduction = 'production';
  static EnvironmentSandbox = 'sandbox';
  disableGoogleAdIdReading = vi.fn();
}
class FakeSharing {
  addGranularOption = vi.fn();
}
class FakeAdRevenue {
  setRevenue = vi.fn();
  setAdRevenueNetwork = vi.fn();
}
class FakeEvent {
  setRevenue = vi.fn();
  setDeduplicationId = vi.fn();
}

function installSdks() {
  setAnalyticsSdkForTesting({
    getAnalytics: () => 'analytics',
    logEvent,
    setAnalyticsCollectionEnabled,
  } as never);
  setCrashlyticsSdkForTesting({
    getCrashlytics: () => 'crashlytics',
    recordError,
    setCrashlyticsCollectionEnabled,
  } as never);
  setAdjustSdkForTesting({
    Adjust: { initSdk, trackAdRevenue: trackAdRevenueNative, trackEvent, trackThirdPartySharing },
    AdjustConfig: FakeConfig,
    AdjustThirdPartySharing: FakeSharing,
    AdjustAdRevenue: FakeAdRevenue,
    AdjustEvent: FakeEvent,
  } as never);
}

async function startWithRegion(region: ConsentRegion) {
  adsStore.setConsentRegion(region);
  await initializeAdjust(region);
}

function sendEverything() {
  trackAdRevenue({ adUnitId: 'u', revenue: 0.01, networkName: 'AppLovin' });
  trackFirstPurchase({ price: 4.99, currency: 'USD', orderId: 'GPA.1' });
  reportMissingHiddenEvent('rewarded', 'AppLovin');
}

describe('measurementAllowed', () => {
  beforeEach(() => adsStore.reset());

  it('allows only OTHER', () => {
    expect(measurementAllowed('OTHER')).toBe(true);
    expect(measurementAllowed('GDPR')).toBe(false);
    expect(measurementAllowed('UNKNOWN')).toBe(false);
  });

  it('reads the store region by default and stays off before the region is known', () => {
    expect(measurementAllowed()).toBe(false);
    adsStore.setConsentRegion('OTHER');
    expect(measurementAllowed()).toBe(true);
    adsStore.setConsentRegion('GDPR');
    expect(measurementAllowed()).toBe(false);
  });
});

describe('third-party measurement by consent region', () => {
  const mutableAdjust = ADS_CONFIG.adjust as { appToken: string; purchaseEventToken: string };
  const saved = { ...mutableAdjust };

  beforeEach(() => {
    vi.clearAllMocks();
    adsStore.reset();
    resetRevenueForTesting();
    installSdks();
    mutableAdjust.appToken = 'app-token';
    mutableAdjust.purchaseEventToken = 'purchase-token';
    return () => Object.assign(mutableAdjust, saved);
  });

  it('OTHER: sends Firebase ad_impression, Adjust revenue, Adjust purchase and Crashlytics', async () => {
    await startWithRegion('OTHER');
    sendEverything();

    expect(logEvent).toHaveBeenCalledWith('analytics', 'ad_impression', expect.any(Object));
    expect(trackAdRevenueNative).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(recordError).toHaveBeenCalledTimes(1);
    expect(trackThirdPartySharing).not.toHaveBeenCalled();
    expect(setAnalyticsCollectionEnabled).toHaveBeenCalledWith('analytics', true);
    expect(setCrashlyticsCollectionEnabled).toHaveBeenCalledWith('crashlytics', true);
  });

  it.each(['GDPR', 'UNKNOWN'] as const)('%s: blocks every measurement signal', async (region) => {
    await startWithRegion(region);
    sendEverything();

    expect(logEvent).not.toHaveBeenCalled();
    expect(trackAdRevenueNative).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(recordError).not.toHaveBeenCalled();
    expect(setAnalyticsCollectionEnabled).toHaveBeenCalledWith('analytics', false);
    expect(setCrashlyticsCollectionEnabled).toHaveBeenCalledWith('crashlytics', false);
  });

  it.each(['GDPR', 'UNKNOWN'] as const)('%s: does not start Adjust at all', async (region) => {
    await startWithRegion(region);
    expect(initSdk).not.toHaveBeenCalled();
    expect(trackThirdPartySharing).not.toHaveBeenCalled();
  });

  it('OTHER: starts Adjust once', async () => {
    await startWithRegion('OTHER');
    expect(initSdk).toHaveBeenCalledTimes(1);
  });

  it('drops Adjust events in a session where Adjust never started, even if the store later says OTHER', async () => {
    await startWithRegion('UNKNOWN'); // consent wait timed out
    adsStore.setConsentRegion('OTHER');
    trackAdRevenue({ adUnitId: 'u', revenue: 0.01 });
    trackFirstPurchase({ price: 1, currency: 'USD', orderId: 'x' });

    expect(trackAdRevenueNative).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('applyMeasurementConsent switches collection per region', () => {
    applyMeasurementConsent('GDPR');
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith('analytics', false);
    applyMeasurementConsent('OTHER');
    expect(setCrashlyticsCollectionEnabled).toHaveBeenLastCalledWith('crashlytics', true);
  });
});
