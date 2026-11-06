import { getBillingConfig } from './billing-config';
import type { BillingProductInfo, PlanKind } from './billing-store';

function mockProduct(
  productId: string,
  planKind: PlanKind,
  title: string,
  price: number,
  billingPeriodIso: string,
  savingsPercent: number | null,
): BillingProductInfo {
  return {
    productId,
    planKind,
    title,
    localizedPrice: `$${price.toFixed(2)}`,
    priceAmountMicros: price * 1_000_000,
    priceCurrencyCode: 'USD',
    billingPeriodIso,
    hasFreeTrial: false,
    freeTrialDays: 0,
    baseOfferToken: null,
    trialOfferToken: null,
    savingsPercent,
  };
}

/** Giá theo MONETIZATION_PLAYBOOK. Chỉ để hiển thị khi Play chưa trả gói, không bao giờ được mua. */
export function getMockBillingProducts(): Record<string, BillingProductInfo> {
  const { weeklyId, yearlyId } = getBillingConfig();
  return {
    [yearlyId]: mockProduct(yearlyId, 'yearly', 'VIP Yearly', 99, 'P1Y', 73),
    [weeklyId]: mockProduct(weeklyId, 'weekly', 'VIP Weekly', 6.99, 'P1W', null),
  };
}

/**
 * Giá mẫu chỉ cho bản debug (__DEV__) và preview (EXPO_PUBLIC_BILLING_MOCK_PRICES=true trong eas.json).
 * Mặc định tắt, kể cả release build local và production.
 */
export function mockPricesAllowed(): boolean {
  const dev = typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
  return dev || process.env.EXPO_PUBLIC_BILLING_MOCK_PRICES === 'true';
}

/**
 * Dữ liệu thật của Play luôn thắng. Không có gói nào thì: bản được phép thì dùng giá mẫu (isMock);
 * bản khác thì không có gói nào để hiện (unavailable), paywall chỉ nêu quyền lợi và thông báo tạm thời.
 */
export function resolveDisplayProducts(
  products: Record<string, BillingProductInfo>,
  allowMock: boolean = mockPricesAllowed(),
): {
  products: Record<string, BillingProductInfo>;
  isMock: boolean;
  unavailable: boolean;
} {
  if (Object.keys(products).length > 0) {
    return { products, isMock: false, unavailable: false };
  }
  if (allowMock) {
    return { products: getMockBillingProducts(), isMock: true, unavailable: false };
  }
  return { products: {}, isMock: false, unavailable: true };
}
