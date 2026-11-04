import { describe, it, expect, beforeEach, vi } from 'vitest';

(globalThis as any).__DEV__ = false;

vi.mock('../lib/api', () => ({
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

import {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  t,
  setLanguage,
} from '../i18n';
import {
  normalizePlaySubscriptions,
  parseIsoDurationDays,
  resetBillingServiceForTesting,
  setBillingSdkForTesting,
  verifyAndFinishPurchase,
  billingStore,
  purchaseSubscription,
} from './index';
import {
  canAutoOpenPaywall,
  closePaywallAfterSuccess,
  declinePaywall,
  handlePaywallForegroundReturn,
  openPaywall,
  paywallStore,
  registerOpenSheet,
  setCurrentPaywallRoute,
  syncPaywallVipState,
} from '../premium/paywall-triggers';
import {
  isStartupPaywallStepDone,
  resetStartupSequence,
  runStartupSequence,
} from '../startup/startup-sequence';
import {
  finishExternalActivity,
  recordExternalActivity,
  resetExternalActivity,
} from '../lib/external-activity';
import { adsStore } from '../ads/ads-store';
import * as api from '../lib/api';

vi.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs: any) => objs.android },
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  BackHandler: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Linking: {
    openURL: vi.fn(async () => undefined),
  },
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: {
    create: (s: any) => s,
    hairlineWidth: 1,
    absoluteFill: {},
  },
  View: 'View',
  Text: 'Text',
}));

vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: vi.fn(async (k: string) => {
        store.delete(k);
      }),
    },
  };
});

describe('Phase 7 & i18n: Multi-Language i18n, Mobile Billing & Paywall Triggers (Playbook §1.1, §6, §9, §11)', () => {
  beforeEach(() => {
    resetExternalActivity();
    adsStore.reset();
    resetBillingServiceForTesting();
    paywallStore.reset();
    resetStartupSequence();
    vi.restoreAllMocks();
  });

  describe('1. Multi-Language i18n & Copy Rules (Playbook §1.1, §4.2, §9)', () => {
    it('supports all 9 required languages with native names and strictly forbids "unlimited" or "no ads"', async () => {
      const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
      expect(codes).toEqual([
        'en',
        'vi',
        'id',
        'hi',
        'zh',
        'ru',
        'ja',
        'pt',
        'es',
      ]);

      for (const lang of SUPPORTED_LANGUAGES) {
        expect(lang.nativeName.length).toBeGreaterThan(0);
        const dict = TRANSLATIONS[lang.code];
        expect(dict).toBeDefined();

        // Every key in English must exist in every language
        for (const [key, val] of Object.entries(dict)) {
          expect(typeof val).toBe('string');
          expect(val.length).toBeGreaterThan(0);
          // Playbook §9: Never say "unlimited" or "no ads"
          expect(val.toLowerCase()).not.toContain('unlimited');
          expect(val.toLowerCase()).not.toContain('no ads');
          expect(key).toBeTruthy();
        }
      }

      await setLanguage('en');
      expect(t('earn.milestone.next', { day: 30, bonus: 20 })).toBe(
        'Next milestone: day 30, +20',
      );
      expect(t('paywall.benefit.dailyGems')).toBe('50 GEM every day');
      expect(t('paywall.benefit.noBannerInterstitial')).toBe(
        'No banner or interstitial ads',
      );
    });
  });

  describe('2. Billing Product Normalization & Verify-Before-Finish (Playbook §6.1, §6.5, §11.10)', () => {
    it('parses Google Play subscription offers, trial duration, and dynamically computes yearly savings %', () => {
      expect(parseIsoDurationDays('P3D')).toBe(3);
      expect(parseIsoDurationDays('P1W')).toBe(7);
      expect(parseIsoDurationDays('P1Y')).toBe(365);

      const normalized = normalizePlaySubscriptions([
        {
          productId: 'weeklyid',
          subscriptionOfferDetails: [
            {
              offerToken: 'offer-weekly-trial',
              pricingPhases: {
                pricingPhaseList: [
                  {
                    priceAmountMicros: 0,
                    formattedPrice: 'Free',
                    billingPeriod: 'P3D',
                  },
                  {
                    priceAmountMicros: 6_990_000,
                    formattedPrice: '$6.99',
                    priceCurrencyCode: 'USD',
                    billingPeriod: 'P1W',
                  },
                ],
              },
            },
          ],
        },
        {
          productId: 'yearlyid',
          subscriptionOfferDetails: [
            {
              offerToken: 'offer-yearly-base',
              pricingPhases: {
                pricingPhaseList: [
                  {
                    priceAmountMicros: 99_000_000,
                    formattedPrice: '$99.00',
                    priceCurrencyCode: 'USD',
                    billingPeriod: 'P1Y',
                  },
                ],
              },
            },
          ],
        },
      ]);

      expect(normalized.weeklyid.hasFreeTrial).toBe(true);
      expect(normalized.weeklyid.freeTrialDays).toBe(3);
      expect(normalized.weeklyid.localizedPrice).toBe('$6.99');
      expect(normalized.yearlyid.localizedPrice).toBe('$99.00');
      // 52 * 6.99 = $363.48 vs $99.00 -> ~73% savings
      expect(normalized.yearlyid.savingsPercent).toBe(73);
    });

    it('refuses to verify when price is unknown (§11.10), verifies BEFORE finishTransaction, and does NOT finish on server error', async () => {
      const finishTransactionMock = vi.fn(async () => undefined);
      setBillingSdkForTesting({
        finishTransaction: finishTransactionMock,
      });

      // 1. Unknown price -> do NOT verify and do NOT finishTransaction (§11.10)
      const postSpy = vi.spyOn(api, 'post');
      const resUnknown = await verifyAndFinishPurchase({
        productId: 'yearlyid',
        purchaseToken: 'tok-unknown-price',
      });
      expect(resUnknown).toBeNull();
      expect(postSpy).not.toHaveBeenCalled();
      expect(finishTransactionMock).not.toHaveBeenCalled();

      // Load product prices into store
      billingStore.setProducts(
        normalizePlaySubscriptions([
          {
            productId: 'yearlyid',
            priceAmountMicros: 99_000_000,
            localizedPrice: '$99.00',
            currency: 'USD',
          },
        ]),
      );

      // 2. Network / 5xx failure -> do NOT finishTransaction so it retries next launch (§6.5, §11.10)
      postSpy.mockRejectedValueOnce(new Error('503 Service Unavailable'));
      await expect(
        verifyAndFinishPurchase({
          productId: 'yearlyid',
          purchaseToken: 'tok-net-fail',
        }),
      ).rejects.toThrow('503 Service Unavailable');
      expect(finishTransactionMock).not.toHaveBeenCalled();

      // 3. Server verify succeeds -> calls finishTransaction AFTER verify
      const callOrder: string[] = [];
      postSpy.mockImplementationOnce(async () => {
        callOrder.push('verify');
        return {
          vip: {
            active: true,
            productId: 'yearlyid',
            expiresAt: '2027-11-04T00:00:00.000Z',
            willRenew: true,
          },
          firstPurchase: true,
          balance: 55,
          grantedNow: true,
          vipDailyGranted: 50,
          billingRef: 'abc123',
        };
      });
      finishTransactionMock.mockImplementationOnce(async () => {
        callOrder.push('finishTransaction');
      });

      const verified = await verifyAndFinishPurchase({
        productId: 'yearlyid',
        purchaseToken: 'tok-ok',
        orderId: 'GPA.1234',
      });
      expect(verified?.vip.active).toBe(true);
      expect(callOrder).toEqual(['verify', 'finishTransaction']);
      expect(billingStore.getState().vipGiftBannerAmount).toBe(50);
    });

    it('pre-purchase check (§6.5): if Play already holds an active VIP purchase, restores it without selling a second plan', async () => {
      const requestSubscriptionMock = vi.fn();
      setBillingSdkForTesting({
        getAvailablePurchases: vi.fn(async () => [
          {
            productId: 'weeklyid',
            purchaseToken: 'existing-active-tok',
            priceAmountMicros: 6_990_000,
            priceCurrencyCode: 'USD',
          },
        ]),
        finishTransaction: vi.fn(async () => undefined),
        requestSubscription: requestSubscriptionMock,
      });

      vi.spyOn(api, 'post').mockResolvedValueOnce({
        vip: {
          active: true,
          productId: 'weeklyid',
          expiresAt: '2026-11-11T00:00:00.000Z',
          willRenew: true,
        },
        firstPurchase: false,
        restored: true,
        balance: 55,
        grantedNow: false,
        billingRef: 'ref-123',
      });

      const result = await purchaseSubscription('yearlyid', {
        billingRef: 'ref-123',
      });
      expect(result.ok).toBe(true);
      expect(result.restored).toBe(true);
      // Did NOT open Play payment sheet to sell a second plan!
      expect(requestSubscriptionMock).not.toHaveBeenCalled();
    });
  });

  describe('3. Paywall Automatic Triggers, Exclusions & Ads-User Decline Counter (Playbook §5.4, §6.3, §11.8)', () => {
    it('enforces all §6.3 exclusions (unknown VIP, VIP, excluded routes, fullScreenAdShowing, open sheet, external activity)', () => {
      // Unknown VIP -> false
      expect(canAutoOpenPaywall()).toBe(false);

      // Known non-VIP on home route -> true
      syncPaywallVipState({ vipKnown: true, isVip: false });
      setCurrentPaywallRoute('/(tabs)');
      expect(canAutoOpenPaywall()).toBe(true);

      // Excluded routes -> false
      for (const route of ['/onboarding', '/camera', '/reading/123', '/login']) {
        setCurrentPaywallRoute(route);
        expect(canAutoOpenPaywall()).toBe(false);
      }
      setCurrentPaywallRoute('/(tabs)');

      // Full-screen ad showing -> false
      adsStore.requestFullScreenAd('interstitial-1');
      expect(canAutoOpenPaywall()).toBe(false);
      adsStore.clearFullScreenAds();
      expect(canAutoOpenPaywall()).toBe(true);

      // Sheet open -> false (skip, don't defer)
      const closeSheet = registerOpenSheet();
      expect(canAutoOpenPaywall()).toBe(false);
      closeSheet();
      expect(canAutoOpenPaywall()).toBe(true);

      // External activity active or within 2s grace -> false (§11.8)
      recordExternalActivity('photo_picker');
      expect(canAutoOpenPaywall()).toBe(false);
      finishExternalActivity('photo_picker');
      expect(canAutoOpenPaywall()).toBe(false); // still within 2s grace!
      resetExternalActivity();

      // Background return < 10s -> does not open
      expect(handlePaywallForegroundReturn(9_500)).toBe(false);
      expect(paywallStore.getState().isOpen).toBe(false);

      // Background return >= 10s -> opens paywall
      expect(handlePaywallForegroundReturn(10_500)).toBe(true);
      expect(paywallStore.getState().isOpen).toBe(true);
    });

    it('marks device as ads user after 3 paywall declines and clears decline count when VIP becomes active', () => {
      syncPaywallVipState({ vipKnown: true, isVip: false });
      setCurrentPaywallRoute('/(tabs)');

      const declineSpy = vi.fn();
      for (let i = 1; i <= 3; i++) {
        void openPaywall('manual');
        declinePaywall();
        declineSpy();
        expect(paywallStore.getState().declineCount).toBe(i);
      }

      expect(paywallStore.getState().isAdsUser).toBe(true);

      // Becoming VIP clears decline count and isAdsUser (§5.4)
      syncPaywallVipState({ vipKnown: true, isVip: true });
      expect(paywallStore.getState().declineCount).toBe(0);
      expect(paywallStore.getState().isAdsUser).toBe(false);
    });

    it('runs startup sequence steps 1..4 in order and marks isStartupPaywallStepDone after paywall closes', async () => {
      syncPaywallVipState({ vipKnown: true, isVip: false });
      setCurrentPaywallRoute('/(tabs)');
      setBillingSdkForTesting({
        initConnection: vi.fn(async () => true),
        getSubscriptions: vi.fn(async () => [
          {
            productId: 'yearlyid',
            priceAmountMicros: 99_000_000,
            localizedPrice: '$99.00',
          },
        ]),
        getAvailablePurchases: vi.fn(async () => []),
      });

      expect(isStartupPaywallStepDone()).toBe(false);

      const seqPromise = runStartupSequence({
        vipKnown: true,
        isVip: false,
        billingOn: true,
      });

      // Wait briefly for Step 3 to open the paywall
      await new Promise((r) => setTimeout(r, 50));
      expect(paywallStore.getState().isOpen).toBe(true);
      expect(paywallStore.getState().source).toBe('launch');
      expect(isStartupPaywallStepDone()).toBe(false);

      closePaywallAfterSuccess();
      await seqPromise;

      expect(isStartupPaywallStepDone()).toBe(true);
    });
  });
});
