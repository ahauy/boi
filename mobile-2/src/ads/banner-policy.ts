import { canShowAds, CanShowAdsContext, ADS_CONFIG } from './ads-config';

/**
 * Banner Policy Rules (Playbook §5.2, §5.3, §11.4)
 *
 * Defines route exclusions, collapse rules, and mount eligibility for the root banner.
 */

export const EXCLUDED_BANNER_ROUTE_PREFIXES = [
  '/camera',
  '/paywall',
  '/sign-in',
  '/consent',
  '/login',
];

export interface ShouldCollapseBannerOptions {
  pathname: string;
  isKeyboardOpen: boolean;
  fullScreenAdShowing: boolean;
  nativeAdsOnScreen: number;
}

/**
 * Checks whether the current route is excluded from showing a banner (§5.2).
 */
export function isBannerRouteExcluded(pathname?: string | null): boolean {
  if (!pathname) return false;
  const normalized = pathname.toLowerCase();
  return EXCLUDED_BANNER_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * Determines whether the banner should collapse to height 0 (Pitfall §11.4).
 *
 * When collapsed, the banner remains mounted in memory with autoRefresh paused/disabled,
 * so it never loses its fill when navigating back.
 */
export function shouldCollapseBanner(options: ShouldCollapseBannerOptions): boolean {
  if (isBannerRouteExcluded(options.pathname)) {
    return true;
  }
  if (options.isKeyboardOpen) {
    return true;
  }
  if (options.fullScreenAdShowing) {
    return true;
  }
  if (options.nativeAdsOnScreen > 0) {
    return true;
  }
  return false;
}

/**
 * Determines whether the banner component should be mounted at all (§5.3).
 * Unmount only when the device may not have a banner (VIP, ads off, no unit).
 */
export function shouldMountBanner(ctx: CanShowAdsContext): boolean {
  if (!ADS_CONFIG.units.banner) {
    return false;
  }
  return canShowAds('banner', ctx);
}
