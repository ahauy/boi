import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Ads Configuration (Playbook §1.2, §2.1, §5.1, §5.2)
 *
 * Reads MAX ad unit IDs, SDK keys, Adjust and Play Store variables from env.
 * Enforces format display permissions based on VIP status and screen context.
 */

export type AdFormat = 'banner' | 'native' | 'mrec' | 'interstitial' | 'rewarded';

export interface CanShowAdsContext {
  /** Has /api/v1/me or cache returned VIP state? */
  vipKnown: boolean;
  /** Is the current account an active VIP subscriber? */
  isVip: boolean;
  /** Is the user currently in the onboarding funnel before an account exists? */
  isOnboarding?: boolean;
}

const extra = (Constants.expoConfig?.extra ?? {}) as { applovinSdkKey?: string };
const webRoot = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://boi-two-delta.vercel.app').replace(/\/+$/, '');

export const ADS_CONFIG = {
  // APPLOVIN_SDK_KEY has no EXPO_PUBLIC_ prefix, so it reaches JS only through app config `extra`.
  appLovinSdkKey: extra.applovinSdkKey ?? '',

  units: {
    banner: process.env.EXPO_PUBLIC_MAX_ANDROID_BANNER_ID ?? '',
    interstitial: process.env.EXPO_PUBLIC_MAX_ANDROID_INTERSTITIAL_ID ?? '',
    rewarded: process.env.EXPO_PUBLIC_MAX_ANDROID_REWARDED_ID ?? '',
    native: process.env.EXPO_PUBLIC_MAX_ANDROID_NATIVE_ID ?? '',
    mrec: process.env.EXPO_PUBLIC_MAX_ANDROID_MREC_ID ?? '',
  },

  testDeviceIds: (process.env.EXPO_PUBLIC_MAX_TEST_DEVICE_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  adjust: {
    appToken: process.env.EXPO_PUBLIC_ADJUST_APP_TOKEN ?? '',
    purchaseEventToken: process.env.EXPO_PUBLIC_ADJUST_PURCHASE_EVENT_TOKEN ?? '',
    environment: (process.env.EXPO_PUBLIC_ADJUST_ENVIRONMENT ?? 'production') as 'production' | 'sandbox',
  },

  urls: {
    privacy: `${webRoot}/privacy`,
    terms: `${webRoot}/terms`,
    dataDeletion: `${webRoot}/data-deletion`,
  },
} as const;

/**
 * Check whether ads are enabled and compiled for this build.
 * Android only unless owner enables iOS (§5).
 */
export function adsInBuild(): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }
  const flag = process.env.EXPO_PUBLIC_ADS_ENABLED;
  if (flag === 'false') {
    return false;
  }
  return Boolean(ADS_CONFIG.appLovinSdkKey);
}

/**
 * Determines whether a given ad format can be displayed (§5.1).
 *
 * Rules:
 * - Banner, fill-space (native, mrec) and interstitial: only accounts KNOWN to be non-VIP.
 *   Unknown VIP status (no /v1/me answer yet) = show nothing.
 *   Exception: onboarding before sign-in has no account, so banner shows.
 * - Rewarded: everyone, including VIP.
 */
export function canShowAds(format: AdFormat, ctx: CanShowAdsContext): boolean {
  if (!adsInBuild()) {
    return false;
  }

  // Rewarded ads are accessible to all users (including VIP)
  if (format === 'rewarded') {
    return true;
  }

  // During onboarding before sign-in, banner is allowed (§5.1)
  if (format === 'banner' && ctx.isOnboarding) {
    return true;
  }

  // Non-rewarded ads require known VIP status and MUST NOT be VIP
  if (!ctx.vipKnown) {
    return false;
  }

  return !ctx.isVip;
}
