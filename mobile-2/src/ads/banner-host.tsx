import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Keyboard, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ADS_CONFIG } from './ads-config';
import { useAdsStore, adsStore } from './ads-store';
import { shouldCollapseBanner, shouldMountBanner } from './banner-policy';
import { getMaxSdk, logAdShown, VIEW_AD_CALLBACKS } from './ads-service';
import { useAuth } from '../state/auth';
import { useOnboarding } from '../state/onboarding';
import { usePaywallTriggerState } from '../premium/paywall-triggers';
import { colors } from '../theme';

/**
 * Root Banner Host (Playbook §5.2, §5.3, §11.4)
 *
 * Single adaptive banner wrapping the navigator.
 * - Before first load: height 0, overflow hidden, not touchable, hidden from accessibility.
 * - After first load: fixed adaptive height plus the safe area inset.
 * - Excluded routes / keyboard / full-screen ads / native ads: COLLAPSE, DO NOT UNMOUNT.
 * - Unmount only when non-eligible (VIP or ads off).
 */

export default function BannerHost() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const adsState = useAdsStore();
  const { user, status: authStatus } = useAuth();
  const { status: onboardingStatus } = useOnboarding();
  const { isOpen: paywallOpen } = usePaywallTriggerState();

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const sdk = getMaxSdk();
  const sdkReady = Boolean(sdk) && adsState.status === 'ready';

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardOpen(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!sdk || !sdkReady) return;
    let cancelled = false;
    sdk.BannerAd.getAdaptiveHeightForWidth(width)
      .then((height) => {
        if (!cancelled) adsStore.setBannerHeight(height);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sdk, sdkReady, width]);

  const { bannerHeight } = adsState;
  const vipKnown = authStatus === 'ready';
  const isVip = Boolean(user?.vip?.active);
  const isOnboarding = onboardingStatus === 'pending' || pathname === '/onboarding';

  const mountEligible = sdkReady && shouldMountBanner({ vipKnown, isVip, isOnboarding });

  const isCollapsed = shouldCollapseBanner({
    pathname,
    isKeyboardOpen,
    paywallOpen,
    fullScreenAdShowing: adsState.fullScreenAdShowing,
    nativeAdsOnScreen: adsState.nativeAdsOnScreen,
  });

  // Height is 0 until the first onAdLoaded or while collapsed (§5.3).
  const isVisible = mountEligible && hasLoadedOnce && !isCollapsed;

  useEffect(() => {
    adsStore.setBannerVisible(isVisible);
    return () => adsStore.setBannerVisible(false);
  }, [isVisible]);

  if (!sdk || !mountEligible) {
    return null;
  }

  const { AdView, AdFormat } = sdk;

  return (
    <View
      style={[
        styles.container,
        { height: isVisible ? bannerHeight + insets.bottom : 0 },
        isVisible ? { paddingBottom: insets.bottom } : styles.collapsed,
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
      aria-hidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!isVisible}
    >
      <AdView
        adUnitId={ADS_CONFIG.units.banner}
        adFormat={AdFormat.BANNER}
        adaptiveBannerEnabled
        autoRefresh={!isCollapsed}
        onAdLoaded={(info) => {
          logAdShown('banner', info);
          setHasLoadedOnce(true);
        }}
        {...VIEW_AD_CALLBACKS}
        style={[styles.adView, { height: bannerHeight }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  collapsed: {
    overflow: 'hidden',
    borderTopWidth: 0,
    opacity: 0,
  },
  adView: {
    width: '100%',
  },
});
