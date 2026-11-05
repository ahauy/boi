import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Keyboard, StyleProp, ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ADS_CONFIG, canShowAds } from './ads-config';
import { useAdsStore, adsStore } from './ads-store';
import { getMaxSdk, logAdShown, releaseMrec, takePreloadedMrec, VIEW_AD_CALLBACKS } from './ads-service';
import { useAuth } from '../state/auth';
import { useI18n } from '../i18n';
import { colors } from '../theme';

/**
 * Fill-space Ad Slot (Playbook §5.2, §9, §11.5, §11.6, §11.7)
 *
 * - Native (Manual unit) first; MREC 300x250 only when native has no fill and room >= 298x300 dp.
 * - Layout by room: >= 355 dp large, >= 218 dp compact, else nothing.
 * - Mount only when visible (focused, no full-screen ad, no keyboard), one request per mount,
 *   no refresh. A no-fill is final for that mount.
 * - The card height is fixed from mount, so it never grows and Continue never jumps.
 * - Shows the "Ad" badge first in reading order, then AdChoices, with a distinct CTA (§9).
 * - Registers in `nativeAdsOnScreen` while an ad is visible so the root banner collapses.
 */

const LARGE_ROOM_HEIGHT = 355;
const COMPACT_ROOM_HEIGHT = 218;
const MREC_ROOM_HEIGHT = 300;
const MREC_ROOM_WIDTH = 298;
const LARGE_SLOT_HEIGHT = 300;
const COMPACT_SLOT_HEIGHT = 200;
const MREC_SLOT_HEIGHT = 275;

type AdStage = 'idle' | 'native' | 'native_shown' | 'mrec' | 'mrec_shown' | 'failed';

export interface NativeAdSlotProps {
  availableHeight?: number;
  availableWidth?: number;
  /** False while the slot is scrolled out of view: no request, and the banner stays up. */
  inViewport?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function NativeAdSlot({
  availableHeight = 360,
  availableWidth = 360,
  inViewport = true,
  style,
}: NativeAdSlotProps) {
  const { user, status: authStatus } = useAuth();
  const adsState = useAdsStore();
  const { t } = useI18n();

  const [isFocused, setIsFocused] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [stage, setStage] = useState<AdStage>('idle');
  const [mrecViewId, setMrecViewId] = useState<number | undefined>(undefined);
  const mrecViewIdRef = useRef<number | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(
    () => () => {
      if (mrecViewIdRef.current !== undefined) releaseMrec(mrecViewIdRef.current);
    },
    []
  );

  const sdk = getMaxSdk();
  const vipKnown = authStatus === 'ready';
  const isVip = Boolean(user?.vip?.active);
  const allowed =
    Boolean(sdk) && adsState.status === 'ready' && canShowAds('native', { vipKnown, isVip });
  const hasRoom = availableHeight >= COMPACT_ROOM_HEIGHT;
  const mrecFits =
    Boolean(ADS_CONFIG.units.mrec) &&
    availableHeight >= MREC_ROOM_HEIGHT &&
    availableWidth >= MREC_ROOM_WIDTH;

  const startMrecFallback = useCallback(() => {
    if (!mrecFits) {
      setStage('failed');
      return;
    }
    const preloaded = takePreloadedMrec();
    mrecViewIdRef.current = preloaded;
    setMrecViewId(preloaded);
    setStage(preloaded === undefined ? 'mrec' : 'mrec_shown');
  }, [mrecFits]);

  // One request per mount: `stage` leaves 'idle' once and never returns to it (§11.6).
  useEffect(() => {
    if (stage !== 'idle' || !allowed || !hasRoom) return;
    if (!isFocused || !inViewport || adsState.fullScreenAdShowing || isKeyboardOpen) return;
    if (ADS_CONFIG.units.native) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot latch driven by visibility
      setStage('native');
    } else {
      startMrecFallback();
    }
  }, [
    stage,
    allowed,
    hasRoom,
    isFocused,
    inViewport,
    adsState.fullScreenAdShowing,
    isKeyboardOpen,
    startMrecFallback,
  ]);

  const isShowingAd =
    (stage === 'native_shown' || stage === 'mrec_shown') && isFocused && inViewport;
  useEffect(() => {
    if (isShowingAd) {
      return adsStore.registerNativeAd();
    }
  }, [isShowingAd]);

  if (!sdk || !allowed || !hasRoom || stage === 'idle' || stage === 'failed') {
    return null;
  }

  const { AdView, AdFormat, NativeAdView, TitleView, AdvertiserView, BodyView } = sdk;
  const { CallToActionView, OptionsView, MediaView } = sdk;

  const isLarge = availableHeight >= LARGE_ROOM_HEIGHT;
  const slotHeight = isLarge
    ? LARGE_SLOT_HEIGHT
    : mrecFits
      ? MREC_SLOT_HEIGHT
      : COMPACT_SLOT_HEIGHT;
  const showingNative = stage === 'native' || stage === 'native_shown';

  return (
    <View style={[styles.container, { height: slotHeight }, style]}>
      {showingNative ? (
        <NativeAdView
          adUnitId={ADS_CONFIG.units.native}
          onAdLoaded={(info) => {
            logAdShown('native', info);
            setStage('native_shown');
          }}
          onAdLoadFailed={startMrecFallback}
          {...VIEW_AD_CALLBACKS}
          style={[styles.nativeAd, stage === 'native' && styles.hiddenUntilLoaded]}
        >
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.adBadge}>
                <Text style={styles.adBadgeText}>{t('common.adBadge')}</Text>
              </View>
              <OptionsView style={styles.adChoicesView} collapsable={false} />
            </View>

            {isLarge ? <MediaView style={styles.mediaView} collapsable={false} /> : null}

            <TitleView style={styles.titleText} numberOfLines={1} />
            <AdvertiserView style={styles.advertiserText} numberOfLines={1} />
            <BodyView style={styles.bodyText} numberOfLines={2} />
            <CallToActionView style={styles.ctaButton} />
          </View>
        </NativeAdView>
      ) : (
        <View style={styles.mrecWrapper}>
          <View style={styles.mrecHeader}>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>{t('common.adBadge')}</Text>
            </View>
          </View>
          <AdView
            adUnitId={ADS_CONFIG.units.mrec}
            adFormat={AdFormat.MREC}
            adViewId={mrecViewId}
            autoRefresh={false}
            onAdLoaded={(info) => {
              logAdShown('mrec', info);
              setStage('mrec_shown');
            }}
            onAdLoadFailed={() => setStage('failed')}
            {...VIEW_AD_CALLBACKS}
            style={styles.mrecView}
          />
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
  nativeAd: {
    width: '100%',
    height: '100%',
  },
  hiddenUntilLoaded: {
    opacity: 0,
  },
  card: {
    flex: 1,
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
  mediaView: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#000',
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
    backgroundColor: '#2563EB', // Blue, distinct from the app's primary buttons (§9)
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 6,
  },
  mrecWrapper: {
    width: 300,
    height: MREC_SLOT_HEIGHT,
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
