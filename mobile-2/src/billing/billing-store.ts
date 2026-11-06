import { useEffect, useState } from 'react';

export type PlanKind = 'weekly' | 'yearly' | 'monthly';

export interface BillingProductInfo {
  productId: string;
  planKind: PlanKind;
  title: string;
  localizedPrice: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  billingPeriodIso: string;
  hasFreeTrial: boolean;
  freeTrialDays: number;
  baseOfferToken: string | null;
  trialOfferToken: string | null;
  savingsPercent: number | null;
}

export interface BillingStoreState {
  connected: boolean;
  billingEnabled: boolean;
  products: Record<string, BillingProductInfo>;
  activePurchaseTokens: Record<string, string>;
  isPurchasing: boolean;
  isRestoring: boolean;
  lastReconciledAt: number;
  vipGiftBannerAmount: number | null;
  vipRestoredNotice: boolean;
  lastError: string | null;
}

let state: BillingStoreState = {
  connected: false,
  billingEnabled: false,
  products: {},
  activePurchaseTokens: {},
  isPurchasing: false,
  isRestoring: false,
  lastReconciledAt: 0,
  vipGiftBannerAmount: null,
  vipRestoredNotice: false,
  lastError: null,
};

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[BillingStore] Listener error:', err);
      }
    }
  }
}

/** Có gói thật từ Play hay chưa. Dùng cho mọi chỗ quyết định có mở paywall bán thật. */
export function hasBillingProducts(): boolean {
  return Object.keys(billingStore.getState().products).length > 0;
}

export const billingStore = {
  getState(): BillingStoreState {
    return state;
  },

  setState(partial: Partial<BillingStoreState>): void {
    state = { ...state, ...partial };
    notify();
  },

  setProducts(products: Record<string, BillingProductInfo>): void {
    state = { ...state, products };
    notify();
  },

  recordActivePurchaseToken(productId: string, purchaseToken: string): void {
    state = {
      ...state,
      activePurchaseTokens: {
        ...state.activePurchaseTokens,
        [productId]: purchaseToken,
      },
    };
    notify();
  },

  dismissVipGiftBanner(): void {
    if (state.vipGiftBannerAmount !== null) {
      state = { ...state, vipGiftBannerAmount: null };
      notify();
    }
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  reset(): void {
    state = {
      connected: false,
      billingEnabled: false,
      products: {},
      activePurchaseTokens: {},
      isPurchasing: false,
      isRestoring: false,
      lastReconciledAt: 0,
      vipGiftBannerAmount: null,
      vipRestoredNotice: false,
      lastError: null,
    };
    notify();
  },
};

export function useBillingStore(): BillingStoreState {
  const [snap, setSnap] = useState<BillingStoreState>(billingStore.getState());

  useEffect(() => {
    return billingStore.subscribe(() => {
      setSnap(billingStore.getState());
    });
  }, []);

  return snap;
}
