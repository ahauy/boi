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
  initializeBilling,
  purchaseNoticeKey,
  purchaseSubscription,
  reloadProductsIfMissing,
  restoreNoticeKey,
  restorePurchases,
  retryProductsOnForeground,
} from './index';
import {
  canAutoOpenPaywall,
  closePaywallAfterSuccess,
  declinePaywall,
  handlePaywallForegroundReturn,
  onPaywallDeclined,
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

const phase = (priceAmountMicros: string, formattedPrice: string, billingPeriod: string) => ({
  priceAmountMicros,
  formattedPrice,
  billingPeriod,
  priceCurrencyCode: 'USD',
  billingCycleCount: 1,
  recurrenceMode: 1,
});

const subscriptionProduct = (id: string, subscriptionOffers: unknown[]) =>
  ({ id, currency: 'USD', displayPrice: '', title: id, subscriptionOffers }) as any;

const playPurchase = (productId: string, purchaseToken: string, extra: object = {}) =>
  ({ id: `GPA.${purchaseToken}`, productId, purchaseToken, purchaseState: 'purchased', ...extra }) as any;

const yearlyProducts = () =>
  normalizePlaySubscriptions([
    subscriptionProduct('yearlyid', [
      {
        offerTokenAndroid: 'offer-yearly-base',
        pricingPhasesAndroid: { pricingPhaseList: [phase('99000000', '$99.00', 'P1Y')] },
      },
    ]),
    subscriptionProduct('weeklyid', [
      {
        offerTokenAndroid: 'offer-weekly-base',
        pricingPhasesAndroid: { pricingPhaseList: [phase('6990000', '$6.99', 'P1W')] },
      },
    ]),
  ]);

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
        subscriptionProduct('weeklyid', [
          {
            offerTokenAndroid: 'offer-weekly-trial',
            pricingPhasesAndroid: {
              pricingPhaseList: [
                phase('0', 'Free', 'P3D'),
                phase('6990000', '$6.99', 'P1W'),
              ],
            },
          },
        ]),
        subscriptionProduct('yearlyid', [
          {
            offerTokenAndroid: 'offer-yearly-base',
            pricingPhasesAndroid: {
              pricingPhaseList: [phase('99000000', '$99.00', 'P1Y')],
            },
          },
        ]),
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
      setBillingSdkForTesting({ finishTransaction: finishTransactionMock } as any);

      // 1. Unknown price -> do NOT verify and do NOT finishTransaction (§11.10)
      const postSpy = vi.spyOn(api, 'post');
      const resUnknown = await verifyAndFinishPurchase(playPurchase('yearlyid', 'tok-unknown-price'));
      expect(resUnknown).toBeNull();
      expect(postSpy).not.toHaveBeenCalled();
      expect(finishTransactionMock).not.toHaveBeenCalled();

      // Load product prices into store
      billingStore.setProducts(yearlyProducts());

      // A pending order is not verified: it has not been paid yet.
      const resPending = await verifyAndFinishPurchase(
        playPurchase('yearlyid', 'tok-pending', { purchaseState: 'pending' }),
      );
      expect(resPending).toBeNull();
      expect(postSpy).not.toHaveBeenCalled();

      // 2. Network / 5xx failure -> do NOT finishTransaction so it retries next launch (§6.5, §11.10)
      postSpy.mockRejectedValueOnce(new Error('503 Service Unavailable'));
      await expect(
        verifyAndFinishPurchase(playPurchase('yearlyid', 'tok-net-fail')),
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

      const verified = await verifyAndFinishPurchase(playPurchase('yearlyid', 'tok-ok'));
      expect(verified?.vip.active).toBe(true);
      expect(callOrder).toEqual(['verify', 'finishTransaction']);
      expect(billingStore.getState().vipGiftBannerAmount).toBe(50);
    });

    it('pre-purchase check (§6.5): if Play already holds an active VIP purchase, restores it without selling a second plan', async () => {
      const requestPurchaseMock = vi.fn();
      billingStore.setProducts(yearlyProducts());
      setBillingSdkForTesting({
        getAvailablePurchases: vi.fn(async () => [playPurchase('weeklyid', 'existing-active-tok')]),
        finishTransaction: vi.fn(async () => undefined),
        requestPurchase: requestPurchaseMock,
      } as any);

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
      expect(requestPurchaseMock).not.toHaveBeenCalled();
    });
  });

  describe('2b. Purchase flow always settles (Playbook §6.2, §6.5)', () => {
    function fakeIap(overrides: object = {}) {
      let onPurchase: (purchase: any) => void = () => undefined;
      const requestPurchase = vi.fn(async () => undefined);
      const sdk = {
        ErrorCode: { AlreadyOwned: 'already-owned', UserCancelled: 'user-cancelled' },
        initConnection: vi.fn(async () => true),
        fetchProducts: vi.fn(async () => [
          subscriptionProduct('yearlyid', [
            {
              offerTokenAndroid: 'offer-yearly-base',
              pricingPhasesAndroid: { pricingPhaseList: [phase('99000000', '$99.00', 'P1Y')] },
            },
          ]),
        ]),
        purchaseUpdatedListener: vi.fn((listener) => {
          onPurchase = listener;
          return { remove: vi.fn() };
        }),
        purchaseErrorListener: vi.fn(() => ({ remove: vi.fn() })),
        getAvailablePurchases: vi.fn(async () => []),
        finishTransaction: vi.fn(async () => undefined),
        requestPurchase,
        ...overrides,
      };
      setBillingSdkForTesting(sdk as any);
      return { requestPurchase, emit: (purchase: any) => onPurchase(purchase) };
    }

    it.each([
      ['an unknown purchase state', { purchaseState: 'unknown' }, 99_000_000],
      ['an unknown price', {}, 0],
    ])('finishes the purchase on %s', async (_label, extra, priceAmountMicros) => {
      const { emit } = fakeIap();
      await initializeBilling();
      const products = billingStore.getState().products;
      billingStore.setProducts({
        yearlyid: { ...products.yearlyid, priceAmountMicros },
      });

      const purchase = purchaseSubscription('yearlyid', { billingRef: 'ref-1' });
      await vi.waitFor(() => expect(billingStore.getState().isPurchasing).toBe(true));
      await new Promise((resolve) => setTimeout(resolve, 0));
      emit(playPurchase('yearlyid', 'tok-unconfirmed', extra));

      await expect(purchase).resolves.toMatchObject({ ok: false, pending: true });
      expect(billingStore.getState().isPurchasing).toBe(false);
    });

    it('turns billing on later, when a foreground retry finally gets products', async () => {
      const fetchProducts = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValue([
          subscriptionProduct('yearlyid', [
            {
              offerTokenAndroid: 'offer-yearly-base',
              pricingPhasesAndroid: { pricingPhaseList: [phase('99000000', '$99.00', 'P1Y')] },
            },
          ]),
        ]);
      const getAvailablePurchases = vi.fn(async () => []);
      fakeIap({ fetchProducts, getAvailablePurchases });

      await initializeBilling();
      expect(billingStore.getState().billingEnabled).toBe(false);
      getAvailablePurchases.mockClear();

      await retryProductsOnForeground();

      expect(billingStore.getState().billingEnabled).toBe(true);
      expect(getAvailablePurchases).toHaveBeenCalled();
    }, 10_000);

    it('keeps billing off until products have loaded', async () => {
      let finishFetch: (value: unknown[]) => void = () => undefined;
      fakeIap({ fetchProducts: vi.fn(() => new Promise((resolve) => (finishFetch = resolve))) });

      const init = initializeBilling();
      await vi.waitFor(() => expect(billingStore.getState().connected).toBe(true));
      expect(billingStore.getState().billingEnabled).toBe(false);

      finishFetch([
        subscriptionProduct('yearlyid', [
          {
            offerTokenAndroid: 'offer-yearly-base',
            pricingPhasesAndroid: { pricingPhaseList: [phase('99000000', '$99.00', 'P1Y')] },
          },
        ]),
      ]);
      await init;
      expect(billingStore.getState().billingEnabled).toBe(true);
    });

    it('initializeBilling single-flight: gọi đồng thời chỉ kết nối, nạp và reconcile một lần', async () => {
      const initConnection = vi.fn(async () => true);
      const getAvailablePurchases = vi.fn(async () => []);
      fakeIap({ initConnection, getAvailablePurchases });

      const [a, b] = await Promise.all([initializeBilling(), initializeBilling()]);

      expect(a).toBe(true);
      expect(b).toBe(true);
      expect(initConnection).toHaveBeenCalledTimes(1);
      expect(getAvailablePurchases).toHaveBeenCalledTimes(1);

      // Xong rồi thì lần sau chạy lại bình thường.
      await initializeBilling();
      expect(initConnection).toHaveBeenCalledTimes(2);
    });

    it('reloadProductsIfMissing không treo cả phiên khi SDK treo (timeout 15 giây)', async () => {
      vi.useFakeTimers();
      try {
        fakeIap({ initConnection: vi.fn(() => new Promise<boolean>(() => undefined)) });
        const reload = reloadProductsIfMissing();
        await vi.advanceTimersByTimeAsync(15_000);
        await expect(reload).resolves.toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it('initializeBilling lỗi sau khi đã có gói thật thì không hạ billingEnabled', async () => {
      billingStore.setProducts(yearlyProducts());
      billingStore.setState({ billingEnabled: true });
      fakeIap({ initConnection: vi.fn(async () => { throw new Error('boom'); }) });

      await expect(initializeBilling()).resolves.toBe(false);

      expect(billingStore.getState().billingEnabled).toBe(true);
    });

    it('restore: gói về muộn thì bật billing lại thay vì kẹt false cả phiên', async () => {
      const fetchProducts = vi.fn(async () => [] as unknown[]);
      fakeIap({ fetchProducts, getAvailablePurchases: vi.fn(async () => []) });
      await initializeBilling();
      expect(billingStore.getState().billingEnabled).toBe(false);

      fetchProducts.mockResolvedValue([
        subscriptionProduct('yearlyid', [
          {
            offerTokenAndroid: 'offer-yearly-base',
            pricingPhasesAndroid: { pricingPhaseList: [phase('99000000', '$99.00', 'P1Y')] },
          },
        ]),
      ]);
      await restorePurchases();

      expect(billingStore.getState().billingEnabled).toBe(true);
    }, 10_000);

    it('restore: Play không trả gói thì báo lỗi (restoreFailed), không báo "không có gì để khôi phục"', async () => {
      const getAvailablePurchases = vi.fn(async () => []);
      fakeIap({ fetchProducts: vi.fn(async () => []), getAvailablePurchases });
      await initializeBilling();
      getAvailablePurchases.mockClear();

      const result = await restorePurchases();

      expect(result).toMatchObject({ ok: false, error: 'Products unavailable' });
      expect(restoreNoticeKey(result)).toBe('paywall.restoreFailed');
      expect(getAvailablePurchases).not.toHaveBeenCalled();
    }, 10_000);

    it('đóng paywall giá mẫu (chưa có gói thật) không tính là từ chối và không gọi callback', async () => {
      const declined = vi.fn();
      const off = onPaywallDeclined(declined);
      const closed = openPaywall('manual');
      expect(paywallStore.getState().isOpen).toBe(true);

      declinePaywall();
      await closed;

      expect(paywallStore.getState().isOpen).toBe(false);
      expect(paywallStore.getState().declineCount).toBe(0);
      expect(paywallStore.getState().isAdsUser).toBe(false);
      expect(declined).not.toHaveBeenCalled();
      off();
    });

    it('đóng paywall có gói thật vẫn tính là từ chối', async () => {
      const declined = vi.fn();
      const off = onPaywallDeclined(declined);
      billingStore.setProducts(yearlyProducts());
      void openPaywall('manual');

      declinePaywall();

      expect(paywallStore.getState().declineCount).toBe(1);
      expect(declined).toHaveBeenCalledTimes(1);
      off();
    });

    it.each([
      [{ ok: false, error: 'Verification failed' }, 'paywall.purchaseFailed'],
      [{ ok: false, canceled: true, error: 'cancelled' }, null],
      [{ ok: false, pending: true }, 'paywall.pending'],
      [{ ok: false, upgradeUnavailable: true }, 'paywall.upgradeUnavailable'],
      [{ ok: true }, null],
    ])('tells the user about purchase result %j', (result, key) => {
      expect(purchaseNoticeKey(result)).toBe(key);
    });

    it.each([
      [{ ok: false, restored: false }, 'paywall.restoreNone'],
      [{ ok: false, error: 'Network' }, 'paywall.restoreFailed'],
      [{ ok: true, restored: true }, null],
    ])('tells the user about restore result %j', (result, key) => {
      expect(restoreNoticeKey(result)).toBe(key);
    });

    it('ignores SKUs Play reports as not found', () => {
      const products = normalizePlaySubscriptions([
        { ...subscriptionProduct('yearlyid', []), productStatusAndroid: 'not-found' },
      ]);

      expect(products).toEqual({});
    });

    it('turns billing off when Play returns no products, but still reconciles', async () => {
      const getAvailablePurchases = vi.fn(async () => []);
      fakeIap({ fetchProducts: vi.fn(async () => []), getAvailablePurchases });

      await expect(initializeBilling()).resolves.toBe(false);

      expect(billingStore.getState().billingEnabled).toBe(false);
      expect(getAvailablePurchases).toHaveBeenCalled();
    }, 10_000);

    it('never opens Play for an upgrade without the old token', async () => {
      const { requestPurchase } = fakeIap();
      billingStore.setProducts(yearlyProducts());

      const result = await purchaseSubscription('yearlyid', {
        billingRef: 'ref-1',
        upgradeFromProductId: 'weeklyid',
      });

      expect(result).toMatchObject({ ok: false, upgradeUnavailable: true });
      expect(requestPurchase).not.toHaveBeenCalled();
    });

    it('recovers the old token through reconcile, then replaces it', async () => {
      const { requestPurchase, emit } = fakeIap({
        getAvailablePurchases: vi.fn(async () => [playPurchase('weeklyid', 'old-token')]),
      });
      await initializeBilling();
      billingStore.setProducts(yearlyProducts());
      vi.spyOn(api, 'post').mockResolvedValue({
        vip: { active: true, productId: 'weeklyid', expiresAt: '2027-01-01T00:00:00.000Z', willRenew: true },
        firstPurchase: false,
        balance: 5,
        billingRef: 'ref-1',
      });

      const purchase = purchaseSubscription('yearlyid', {
        billingRef: 'ref-1',
        upgradeFromProductId: 'weeklyid',
      });
      await vi.waitFor(() => expect(requestPurchase).toHaveBeenCalled());

      expect(requestPurchase.mock.calls[0]).toMatchObject([
        {
          request: {
            google: {
              purchaseToken: 'old-token',
              subscriptionProductReplacementParams: {
                oldProductId: 'weeklyid',
                replacementMode: 'charge-full-price',
              },
            },
          },
        },
      ]);

      emit(playPurchase('yearlyid', 'new-token'));
      await expect(purchase).resolves.toMatchObject({ ok: true });
    });
  });

  describe('3. Paywall Automatic Triggers, Exclusions & Ads-User Decline Counter (Playbook §5.4, §6.3, §11.8)', () => {
    beforeEach(() => {
      billingStore.setState({ billingEnabled: true });
    });

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
      billingStore.setProducts(yearlyProducts()); // chỉ gói thật mới tính là từ chối
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
        fetchProducts: vi.fn(async () => [
          subscriptionProduct('yearlyid', [
            {
              offerTokenAndroid: 'offer-yearly-base',
              pricingPhasesAndroid: { pricingPhaseList: [phase('99000000', '$99.00', 'P1Y')] },
            },
          ]),
        ]),
        purchaseUpdatedListener: vi.fn(() => ({ remove: vi.fn() })),
        purchaseErrorListener: vi.fn(() => ({ remove: vi.fn() })),
        getAvailablePurchases: vi.fn(async () => []),
      } as any);

      expect(isStartupPaywallStepDone()).toBe(false);

      const seqPromise = runStartupSequence({
        vipKnown: true,
        isVip: false,
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
