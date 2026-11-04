import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ADS_CONFIG } from './ads-config';
import { useAdsStore, adsStore } from './ads-store';
import { shouldCollapseBanner, shouldMountBanner } from './banner-policy';
import { getAppLovinMaxRaw } from './ads-service';
import { subscribeAdEvent } from './ad-events';
import { useAuth } from '../state/auth';
import { useOnboarding } from '../state/onboarding';
import { colors } from '../theme';

/**
 * Root Banner Host (Playbook §5.2, §5.3, §11.4)
 *
 * Single root banner wrapping the navigator.
 * - Before first load: height 0, overflow hidden, not touchable, hidden from accessibility.
 * - After first load: fixed height (50dp + safe area inset).
 * - Excluded routes / keyboard / full-screen ads / native ads: COLLAPSE, DO NOT UNMOUNT.
 * - Unmount only when non-eligible (VIP or ads off).
 */

const BANNER_HEIGHT = 50;

export default function BannerHost() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const adsState = useAdsStore();
  const { user, status: authStatus } = useAuth();
  const { status: onboardingStatus } = useOnboarding();

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Keyboard open/hide tracking
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardOpen(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Listen for the first banner ad loaded event
  useEffect(() => {
    const unsub = subscribeAdEvent('banner', ADS_CONFIG.units.banner, 'loaded', () => {
      setHasLoadedOnce(true);
    });
    return unsub;
  }, []);

  const vipKnown = authStatus === 'ready';
  const isVip = Boolean(user?.vip?.active);
  const isOnboarding = onboardingStatus === 'pending' || pathname === '/onboarding';

  const mountEligible = shouldMountBanner({
    vipKnown,
    isVip,
    isOnboarding,
  });

  const isCollapsed = shouldCollapseBanner({
    pathname,
    isKeyboardOpen,
    fullScreenAdShowing: adsState.fullScreenAdShowing,
    nativeAdsOnScreen: adsState.nativeAdsOnScreen,
  });

  // Height is 0 until first onAdLoaded or when collapsed (§5.3)
  const isVisible = mountEligible && hasLoadedOnce && !isCollapsed;
  const containerHeight = isVisible ? BANNER_HEIGHT + insets.bottom : 0;

  useEffect(() => {
    adsStore.setBannerVisible(isVisible);
    return () => adsStore.setBannerVisible(false);
  }, [isVisible]);

  if (!mountEligible) {
    return null;
  }

  const MAX = getAppLovinMaxRaw();
  const AdView = MAX?.AdView;
  const AdFormat = MAX?.AdFormat;

  return (
    <View
      style={[
        styles.container,
        {
          height: containerHeight,
          paddingBottom: isVisible ? insets.bottom : 0,
        },
        !isVisible && styles.collapsed,
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
      aria-hidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!isVisible}
    >
      {AdView && AdFormat ? (
        <AdView
          adUnitId={ADS_CONFIG.units.banner}
          adFormat={AdFormat.BANNER}
          autoRefresh={!isCollapsed}
          style={styles.adView}
        />
      ) : (
        // Mock fallback for Expo Go / Web / Test environments
        <View style={styles.mockBanner}>
          <View style={styles.mockAdContent} />
        </View>
      )}
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
    height: 0,
    overflow: 'hidden',
    borderTopWidth: 0,
    opacity: 0,
  },
  adView: {
    width: '100%',
    height: BANNER_HEIGHT,
  },
  mockBanner: {
    width: '100%',
    height: BANNER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockAdContent: {
    width: 320,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
  },
});
