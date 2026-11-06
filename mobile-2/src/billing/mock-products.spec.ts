import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../lib/api';
import { getBillingConfig } from './billing-config';
import { billingStore } from './billing-store';
import { purchaseSubscription, setBillingSdkForTesting } from './billing-service';
import { getMockBillingProducts, mockPricesAllowed, resolveDisplayProducts } from './mock-products';

(globalThis as any).__DEV__ = false;

vi.mock('../lib/api', () => ({ post: vi.fn(), get: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs: any) => objs.android },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Linking: { openURL: vi.fn(async () => undefined) },
}));

describe('resolveDisplayProducts', () => {
  beforeEach(() => {
    billingStore.reset();
  });

  it('không có gói thật thì dùng giá mẫu cho gói năm và tuần, đánh dấu isMock', () => {
    const { weeklyId, yearlyId } = getBillingConfig();
    const { products, isMock, unavailable } = resolveDisplayProducts({}, true);
    expect(unavailable).toBe(false);
    expect(isMock).toBe(true);
    expect(Object.keys(products).sort()).toEqual([weeklyId, yearlyId].sort());
    expect(products[yearlyId].planKind).toBe('yearly');
    expect(products[weeklyId].planKind).toBe('weekly');
    expect(products[yearlyId].baseOfferToken).toBeNull();
    expect(products[yearlyId].savingsPercent).toBe(
      Math.round((1 - 99 / (6.99 * 52)) * 100),
    );
  });

  it('có gói thật thì giữ nguyên dữ liệu thật, isMock=false', () => {
    const real = { ...getMockBillingProducts() };
    const { yearlyId } = getBillingConfig();
    real[yearlyId] = { ...real[yearlyId], localizedPrice: '₫2.000.000', baseOfferToken: 'real-token' };
    for (const allow of [true, false]) {
      const out = resolveDisplayProducts({ [yearlyId]: real[yearlyId] }, allow);
      expect(out.isMock).toBe(false);
      expect(out.unavailable).toBe(false);
      expect(out.products[yearlyId].baseOfferToken).toBe('real-token');
    }
    const out = resolveDisplayProducts({ [yearlyId]: real[yearlyId] }, true);
    expect(out.isMock).toBe(false);
    expect(out.products[yearlyId].baseOfferToken).toBe('real-token');
    expect(Object.keys(out.products)).toEqual([yearlyId]);
  });

  it('tắt cờ giá mẫu + không có gói: không có gói nào để hiện, unavailable', () => {
    const out = resolveDisplayProducts({}, false);
    expect(out).toEqual({ products: {}, isMock: false, unavailable: true });
  });

  it('mockPricesAllowed: mặc định tắt, chỉ bật bằng __DEV__ hoặc cờ preview', () => {
    const prev = process.env.EXPO_PUBLIC_BILLING_MOCK_PRICES;
    try {
      delete process.env.EXPO_PUBLIC_BILLING_MOCK_PRICES;
      expect(mockPricesAllowed()).toBe(false);
      process.env.EXPO_PUBLIC_BILLING_MOCK_PRICES = 'false';
      expect(mockPricesAllowed()).toBe(false);
      process.env.EXPO_PUBLIC_BILLING_MOCK_PRICES = 'true';
      expect(mockPricesAllowed()).toBe(true);
      delete process.env.EXPO_PUBLIC_BILLING_MOCK_PRICES;
      (globalThis as any).__DEV__ = true;
      expect(mockPricesAllowed()).toBe(true);
    } finally {
      (globalThis as any).__DEV__ = false;
      if (prev === undefined) delete process.env.EXPO_PUBLIC_BILLING_MOCK_PRICES;
      else process.env.EXPO_PUBLIC_BILLING_MOCK_PRICES = prev;
    }
  });

  it('giá mẫu không bao giờ mua được: purchaseSubscription không gọi requestPurchase', async () => {
    const { yearlyId } = getBillingConfig();
    const requestPurchase = vi.fn();
    setBillingSdkForTesting({
      getAvailablePurchases: vi.fn(async () => []),
      fetchProducts: vi.fn(async () => []),
      finishTransaction: vi.fn(async () => undefined),
      requestPurchase,
    } as any);
    vi.mocked(api.post).mockRejectedValue(new Error('không được gọi API'));

    const result = await purchaseSubscription(yearlyId, { billingRef: 'ref-1' });

    expect(result).toMatchObject({ ok: false, error: 'Product unavailable' });
    expect(requestPurchase).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(billingStore.getState().isPurchasing).toBe(false);
  }, 10_000);
});
