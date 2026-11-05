import Constants from 'expo-constants';

/**
 * Billing Configuration (Playbook §1.2, §6.1)
 *
 * Reads subscription product IDs from environment variables.
 * - `EXPO_PUBLIC_SUB_WEEKLY_ID` (`weeklyid`)
 * - `EXPO_PUBLIC_SUB_YEARLY_ID` (`yearlyid`)
 * - `EXPO_PUBLIC_SUB_MONTHLY_ID` (optional; empty = hidden)
 *
 * If either weekly or yearly ID is missing, billing and paywall are disabled (§1.2).
 */

/** Package của app trên Google Play, dùng để mở đúng trang gói đăng ký. */
export const ANDROID_PACKAGE_NAME: string =
  Constants.expoConfig?.android?.package ?? 'com.palmsight.mobile2';

export interface BillingConfig {
  weeklyId: string;
  yearlyId: string;
  monthlyId: string;
}

export function getBillingConfig(): BillingConfig {
  const weeklyId = (
    process.env.EXPO_PUBLIC_SUB_WEEKLY_ID ?? 'weeklyid'
  ).trim();
  const yearlyId = (
    process.env.EXPO_PUBLIC_SUB_YEARLY_ID ?? 'yearlyid'
  ).trim();
  const monthlyId = (process.env.EXPO_PUBLIC_SUB_MONTHLY_ID ?? '').trim();

  return {
    weeklyId,
    yearlyId,
    monthlyId,
  };
}

/**
 * Playbook §1.2: Either weekly or yearly missing -> billing and paywall off.
 */
export function isBillingConfigured(): boolean {
  const { weeklyId, yearlyId } = getBillingConfig();
  return Boolean(weeklyId && yearlyId);
}

export function getConfiguredSubscriptionSkus(): string[] {
  const { weeklyId, yearlyId, monthlyId } = getBillingConfig();
  if (!weeklyId || !yearlyId) return [];
  const skus = [yearlyId, weeklyId];
  if (monthlyId) {
    skus.push(monthlyId);
  }
  return skus;
}
