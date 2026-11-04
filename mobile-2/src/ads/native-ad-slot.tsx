import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Keyboard, StyleProp, ViewStyle } from 'react-native';
import { ADS_CONFIG, canShowAds } from './ads-config';
import { useAdsStore, adsStore } from './ads-store';
import { getAppLovinMaxRaw } from './ads-service';
import { useAuth } from '../state/auth';
import { colors } from '../theme';

/**
 * Fill-space Ad Slot (Playbook §5.2, §9, §11.5, §11.6, §11.7)
 *
 * Rules:
 * - Native (Manual type) preferred first; MREC (300x250) fallback when no fill and room >= 298x300 dp.
 * - Sizing by room: >= 355 dp -> Large (300dp), >= 218 dp -> Compact (200dp), else nothing.
 * - Mount only when visible (focused, no full-screen ad, no keyboard).
 * - Exact ONE request per mount, no auto-refresh. No-fill is final.
 * - OptionsView and MediaView need collapsable={false} on Fabric (Pitfall §11.6).
 * - Must show "Ad" badge first in reading order + AdChoices + different CTA style (§9).
 * - Increments `nativeAdsOnScreen` in adsStore so root banner collapses.
 */

export interface NativeAdSlotProps {
  availableHeight?: number;
  availableWidth?: number;
  isFocused?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function NativeAdSlot({
  availableHeight = 360,
  availableWidth = 360,
  isFocused = true,
  style,
}: NativeAdSlotProps) {
  const { user, status: authStatus } = useAuth();
  const adsState = useAdsStore();

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [adStage, setAdStage] = useState<'idle' | 'native_loading' | 'native_loaded' | 'mrec_fallback' | 'failed'>('idle');
  const [nativeAdData, setNativeAdData] = useState<any>(null);

  const hasRequestedRef = useRef(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const vipKnown = authStatus === 'ready';
  const isVip = Boolean(user?.vip?.active);
  const allowed = canShowAds('native', { vipKnown, isVip });
  const hasEnoughHeight = availableHeight >= 218;

  // Single-request per mount (§11.6)
  useEffect(() => {
    if (!allowed || !hasEnoughHeight) return;
    if (!isFocused || adsState.fullScreenAdShowing || isKeyboardOpen) return;
    if (hasRequestedRef.current) return;

    hasRequestedRef.current = true;

    const MAX = getAppLovinMaxRaw();
    if (!MAX?.NativeAdView) {
      // Mock environment (Expo Go / Web / Test)
      const timer = setTimeout(() => {
        setAdStage('native_loaded');
        setNativeAdData({
          title: 'Palmistry & Astrological Guide',
          body: 'Explore ancient insights and discover your celestial journey today.',
          callToAction: 'Learn More',
          advertiser: 'Sponsored Partner',
        });
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setAdStage('native_loading');
    }, 0);
    return () => clearTimeout(timer);
  }, [allowed, hasEnoughHeight, isFocused, adsState.fullScreenAdShowing, isKeyboardOpen]);

  // Register on screen so root banner collapses while native ad is visible (§5.2, §5.3)
  const isShowingAd = adStage === 'native_loaded' || adStage === 'mrec_fallback';
  useEffect(() => {
    if (isShowingAd) {
      return adsStore.registerNativeAd();
    }
  }, [isShowingAd]);

  if (!allowed || !hasEnoughHeight || adStage === 'failed') {
    return null;
  }

  const isLarge = availableHeight >= 355;
  const fixedSlotHeight = isLarge ? 300 : 200;

  const MAX = getAppLovinMaxRaw();
  const NativeAdView = MAX?.NativeAdView;
  const AdView = MAX?.AdView;
  const AdFormat = MAX?.AdFormat;

  const handleNativeLoaded = (nativeAd: any) => {
    setNativeAdData(nativeAd);
    setAdStage('native_loaded');
  };

  const handleNativeFailed = () => {
    // Check if room is sufficient for MREC 300x250 fallback (§5.2)
    if (availableWidth >= 298 && availableHeight >= 300 && ADS_CONFIG.units.mrec) {
      setAdStage('mrec_fallback');
    } else {
      setAdStage('failed');
    }
  };

  return (
    <View
      style={[
        styles.container,
        { height: fixedSlotHeight },
        style,
      ]}
    >
      {/* 1. AppLovin Native Manual View */}
      {NativeAdView && adStage !== 'mrec_fallback' && (
        <NativeAdView
          adUnitId={ADS_CONFIG.units.native}
          onAdLoaded={handleNativeLoaded}
          onAdLoadFailed={handleNativeFailed}
          style={StyleSheet.absoluteFill}
        >
          <View style={[styles.card, { height: fixedSlotHeight }]}>
            {/* Top row: "Ad" badge first in reading order + AdChoices (§9) */}
            <View style={styles.headerRow}>
              <View style={styles.adBadge}>
                <Text style={styles.adBadgeText}>Ad</Text>
              </View>
              {MAX?.OptionsView && (
                <MAX.OptionsView style={styles.adChoicesView} collapsable={false} />
              )}
            </View>

            {/* Media view for large layout */}
            {isLarge && MAX?.MediaView && (
              <MAX.MediaView style={styles.mediaView} collapsable={false} />
            )}

            {/* Title & advertiser */}
            {MAX?.TitleView && (
              <MAX.TitleView style={styles.titleText} numberOfLines={1} />
            )}
            {MAX?.AdvertiserView && (
              <MAX.AdvertiserView style={styles.advertiserText} numberOfLines={1} />
            )}

            {/* Body */}
            {MAX?.BodyView && (
              <MAX.BodyView style={styles.bodyText} numberOfLines={2} />
            )}

            {/* CTA Button: distinct style from primary app buttons (§9) */}
            {MAX?.CallToActionView && (
              <MAX.CallToActionView style={styles.ctaButton} />
            )}
          </View>
        </NativeAdView>
      )}

      {/* 2. MREC Fallback (300x250) */}
      {adStage === 'mrec_fallback' && AdView && AdFormat && (
        <View style={styles.mrecWrapper}>
          <View style={styles.mrecHeader}>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>Ad</Text>
            </View>
          </View>
          <AdView
            adUnitId={ADS_CONFIG.units.mrec}
            adFormat={AdFormat.MREC}
            autoRefresh={false}
            style={styles.mrecView}
            onAdLoadFailed={() => setAdStage('failed')}
          />
        </View>
      )}

      {/* 3. Mock View when native SDK is not linked (Expo Go / Web / Test) */}
      {!NativeAdView && nativeAdData && (
        <View style={[styles.card, { height: fixedSlotHeight }]}>
          <View style={styles.headerRow}>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>Ad</Text>
            </View>
            <Text style={styles.adChoicesText}>AdChoices ℹ️</Text>
          </View>
          {isLarge && <View style={styles.mockMediaView} />}
          <Text style={styles.titleText} numberOfLines={1}>
            {nativeAdData.title}
          </Text>
          <Text style={styles.advertiserText} numberOfLines={1}>
            {nativeAdData.advertiser}
          </Text>
          <Text style={styles.bodyText} numberOfLines={2}>
            {nativeAdData.body}
          </Text>
          <View style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>{nativeAdData.callToAction}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  card: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  adBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  adChoicesView: {
    width: 20,
    height: 20,
  },
  adChoicesText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
  },
  mediaView: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#000',
    marginBottom: 6,
  },
  mockMediaView: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 6,
  },
  titleText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  advertiserText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginBottom: 4,
  },
  bodyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    lineHeight: 16,
  },
  ctaButton: {
    backgroundColor: '#2563EB', // Blue distinct from app primary red/gold buttons (§9)
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  mrecWrapper: {
    width: 300,
    height: 275,
    alignItems: 'center',
  },
  mrecHeader: {
    width: 300,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 4,
  },
  mrecView: {
    width: 300,
    height: 250,
  },
});
