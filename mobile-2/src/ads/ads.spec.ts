import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordExternalActivity,
  finishExternalActivity,
  isExternalActivityActive,
  resetExternalActivity,
} from '../lib/external-activity';
import { canShowAds } from './ads-config';
import { adsStore } from './ads-store';
import { isBannerRouteExcluded, shouldCollapseBanner } from './banner-policy';
import { subscribeAdEvent, dispatchAdEvent, resetAdEvents } from './ad-events';
import { setAnalyticsSdkForTesting, trackAdRevenue } from './revenue';

const mockLogEvent = vi.fn();

vi.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs: any) => objs.android },
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Keyboard: {
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  StyleSheet: {
    create: (s: any) => s,
    hairlineWidth: 1,
    absoluteFill: {},
  },
  View: 'View',
  Text: 'Text',
}));

describe('Phase 3 & Phase 4: Ads Core & Banner / Fill-space (Playbook §2.1, §3, §5, §11)', () => {
  beforeEach(() => {
    resetExternalActivity();
    resetAdEvents();
    adsStore.reset();
    vi.clearAllMocks();
    setAnalyticsSdkForTesting({
      getAnalytics: () => 'analytics',
      logEvent: mockLogEvent,
    } as never);
  });

  describe('1. External Activity Tracker (Playbook §6.3, §11.8)', () => {
    it('records active external activity and respects the 2s grace period after ending', () => {
      expect(isExternalActivityActive()).toBe(false);

      recordExternalActivity('ad');
      expect(isExternalActivityActive()).toBe(true);

      finishExternalActivity('ad');
      // Ended immediately -> still within 2s grace period
      expect(isExternalActivityActive()).toBe(true);

      // Past grace period
      expect(isExternalActivityActive(0)).toBe(false);
    });
  });

  describe('2. Ads Display Permissions (canShowAds, Playbook §5.1)', () => {
    it('enforces non-VIP required for banner/native/mrec/interstitial, allows rewarded for all, and allows banner on onboarding', () => {
      // Rewarded is allowed for everyone (including VIP)
      expect(canShowAds('rewarded', { vipKnown: true, isVip: true })).toBe(true);
      expect(canShowAds('rewarded', { vipKnown: false, isVip: false })).toBe(true);

      // Banner / Native / Interstitial require known VIP status and non-VIP
      expect(canShowAds('banner', { vipKnown: false, isVip: false })).toBe(false);
      expect(canShowAds('banner', { vipKnown: true, isVip: true })).toBe(false);
      expect(canShowAds('banner', { vipKnown: true, isVip: false })).toBe(true);

      expect(canShowAds('native', { vipKnown: true, isVip: true })).toBe(false);
      expect(canShowAds('native', { vipKnown: true, isVip: false })).toBe(true);

      expect(canShowAds('interstitial', { vipKnown: true, isVip: true })).toBe(false);
      expect(canShowAds('interstitial', { vipKnown: true, isVip: false })).toBe(true);

      // Onboarding exception: banner shows before account creation (§5.1)
      expect(canShowAds('banner', { vipKnown: false, isVip: false, isOnboarding: true })).toBe(true);
    });
  });

  describe('3. Global Ads Store (Playbook §11.2, §11.3)', () => {
    it('recomputes fullScreenAdShowing from all active full screen ads and handles multiple concurrent requests', () => {
      expect(adsStore.getState().fullScreenAdShowing).toBe(false);

      adsStore.requestFullScreenAd('interstitial:unit1');
      expect(adsStore.getState().fullScreenAdShowing).toBe(true);

      // A second full screen request (e.g. rewarded ad)
      adsStore.requestFullScreenAd('rewarded:unit2');
      expect(adsStore.getState().fullScreenAdShowing).toBe(true);

      // Interstitial dismisses while rewarded is still active -> fullScreenAdShowing remains true (Pitfall §11.3)
      adsStore.dismissFullScreenAd('interstitial:unit1');
      expect(adsStore.getState().fullScreenAdShowing).toBe(true);

      // Rewarded dismisses -> fullScreenAdShowing becomes false
      adsStore.dismissFullScreenAd('rewarded:unit2');
      expect(adsStore.getState().fullScreenAdShowing).toBe(false);
    });

    it('tracks nativeAdsOnScreen count correctly', () => {
      expect(adsStore.getState().nativeAdsOnScreen).toBe(0);

      const unregister1 = adsStore.registerNativeAd();
      expect(adsStore.getState().nativeAdsOnScreen).toBe(1);

      const unregister2 = adsStore.registerNativeAd();
      expect(adsStore.getState().nativeAdsOnScreen).toBe(2);

      unregister1();
      expect(adsStore.getState().nativeAdsOnScreen).toBe(1);

      unregister2();
      expect(adsStore.getState().nativeAdsOnScreen).toBe(0);
    });
  });

  describe('4. Banner Policy & Collapse Rules (Playbook §5.2, §5.3, §11.4)', () => {
    it('detects excluded routes correctly', () => {
      expect(isBannerRouteExcluded('/camera')).toBe(true);
      expect(isBannerRouteExcluded('/paywall')).toBe(true);
      expect(isBannerRouteExcluded('/sign-in')).toBe(true);
      expect(isBannerRouteExcluded('/consent')).toBe(true);
      expect(isBannerRouteExcluded('/(tabs)/index')).toBe(false);
      expect(isBannerRouteExcluded('/history')).toBe(false);
    });

    it('collapses banner when on excluded route, keyboard open, full-screen ad active, or native ads visible', () => {
      // Normal state -> no collapse
      expect(
        shouldCollapseBanner({
          pathname: '/(tabs)/index',
          isKeyboardOpen: false,
          fullScreenAdShowing: false,
          nativeAdsOnScreen: 0,
        })
      ).toBe(false);

      // Excluded route -> collapse
      expect(
        shouldCollapseBanner({
          pathname: '/camera',
          isKeyboardOpen: false,
          fullScreenAdShowing: false,
          nativeAdsOnScreen: 0,
        })
      ).toBe(true);

      // Keyboard open -> collapse
      expect(
        shouldCollapseBanner({
          pathname: '/(tabs)/index',
          isKeyboardOpen: true,
          fullScreenAdShowing: false,
          nativeAdsOnScreen: 0,
        })
      ).toBe(true);

      // Full screen ad showing -> collapse
      expect(
        shouldCollapseBanner({
          pathname: '/(tabs)/index',
          isKeyboardOpen: false,
          fullScreenAdShowing: true,
          nativeAdsOnScreen: 0,
        })
      ).toBe(true);

      // Native ad visible on screen -> collapse (Pitfall §5.2)
      expect(
        shouldCollapseBanner({
          pathname: '/reading/123',
          isKeyboardOpen: false,
          fullScreenAdShowing: false,
          nativeAdsOnScreen: 1,
        })
      ).toBe(true);
    });
  });

  describe('5. Ad Events Dispatcher & Error Isolation (Playbook §11.1)', () => {
    it('dispatches events by adUnitId and wraps each subscriber in try/catch', () => {
      let callCount = 0;
      let errorThrown = false;

      subscribeAdEvent('interstitial', 'unit-test', 'loaded', () => {
        callCount++;
      });

      // Subscriber that throws an error
      subscribeAdEvent('interstitial', 'unit-test', 'loaded', () => {
        errorThrown = true;
        throw new Error('Subscriber error simulation');
      });

      // Another subscriber that should still run despite previous throw (error isolation)
      let secondSubscriberRan = false;
      subscribeAdEvent('interstitial', 'unit-test', 'loaded', () => {
        secondSubscriberRan = true;
      });

      dispatchAdEvent('interstitial', 'unit-test', 'loaded', { adUnitId: 'unit-test' });

      expect(callCount).toBe(1);
      expect(errorThrown).toBe(true);
      expect(secondSubscriberRan).toBe(true);
    });
  });

  describe('6. Ad Revenue Attribution (Playbook §5.6)', () => {
    it('ignores non-positive revenue, NaN, and negative values', () => {
      for (const revenue of [-1, 0, NaN, Infinity]) {
        expect(() => trackAdRevenue({ adUnitId: 'unit1', revenue })).not.toThrow();
      }
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('sends a positive impression to Firebase as ad_impression', () => {
      trackAdRevenue({ adUnitId: 'unit1', revenue: 0.0025, networkName: 'AppLovin' });
      expect(mockLogEvent).toHaveBeenCalledWith(
        'analytics',
        'ad_impression',
        expect.objectContaining({ value: 0.0025, ad_source: 'AppLovin', currency: 'USD' })
      );
    });
  });
});
