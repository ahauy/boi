import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Text from '../components/AppText';
import CosmicBackground from '../components/CosmicBackground';
import CosmicHand from '../components/CosmicHand';
import { Button } from '../components/ui';
import { colors, font, gradients, radius, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';
import { useI18n } from '../i18n';
import {
  CLOSE_HIT_TARGET_PT,
  DECORATIVE_STAR_COUNT,
  INTRO_SLIDES,
  INTRO_SLIDE_COUNT,
} from './onboarding-machine';

export interface IntroViewProps {
  slideIndex: number;
  onNext: () => void;
  onCloseSlide4: () => void;
}

const SLIDE4_PREVIEW_CARDS = [
  {
    id: 'western',
    icon: 'compass-outline' as const,
    labelKey: 'funnel.step5.western' as const,
  },
  {
    id: 'eastern',
    icon: 'yin-yang' as const,
    labelKey: 'funnel.step5.eastern' as const,
  },
  {
    id: 'vedic',
    icon: 'star-four-points-outline' as const,
    labelKey: 'funnel.step5.vedic' as const,
  },
] as const;

export default function IntroView({
  slideIndex,
  onNext,
  onCloseSlide4,
}: IntroViewProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useI18n();

  const clampedIndex = Math.max(0, Math.min(INTRO_SLIDE_COUNT - 1, slideIndex));
  const slide = INTRO_SLIDES[clampedIndex];
  const isSlide4 = slide.kind === 'showcase';

  const handlePrimaryPress = () => {
    haptic.tap();
    onNext();
  };

  const handleClosePress = () => {
    haptic.tap();
    onCloseSlide4();
  };

  return (
    <View style={styles.root}>
      <CosmicBackground />

      {/* Full-bleed top visual fading into the background (§4.1) */}
      <View style={styles.heroVisualContainer}>
        <LinearGradient
          colors={[...slide.gradientColors]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top header bar — Slide 4 displays the 44pt Close X button */}
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.brandRow}>
            <MaterialCommunityIcons name="star-four-points" size={14} color={colors.gold} />
            <Text style={styles.brandText}>PALMSIGHT</Text>
          </View>

          {isSlide4 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={handleClosePress}
              hitSlop={8}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.ink} />
            </Pressable>
          ) : (
            <View style={styles.closeButtonPlaceholder} />
          )}
        </View>

        {/* Center illustration inside full-bleed fade */}
        <View style={styles.illustrationCenter}>
          {clampedIndex === 0 ? (
            <CosmicHand size={Math.min(width * 0.54, 210)} />
          ) : isSlide4 ? (
            /* Slide 4: 3 feature preview cards/images (§4.1) */
            <View style={styles.previewRow}>
              {SLIDE4_PREVIEW_CARDS.map((card, idx) => (
                <LinearGradient
                  key={card.id}
                  colors={['rgba(231,199,119,0.20)', 'rgba(13,21,48,0.92)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.previewCard,
                    idx === 1 && styles.previewCardCenter,
                  ]}
                >
                  <View style={styles.previewIconCircle}>
                    <MaterialCommunityIcons
                      name={card.icon}
                      size={26}
                      color={colors.goldLight}
                    />
                  </View>
                  <Text numberOfLines={2} style={styles.previewCardLabel}>
                    {t(card.labelKey)}
                  </Text>
                </LinearGradient>
              ))}
            </View>
          ) : (
            <View style={styles.emblemHalo}>
              <LinearGradient
                colors={['rgba(231,199,119,0.26)', 'rgba(19,29,61,0.75)']}
                style={styles.emblemCircle}
              >
                <MaterialCommunityIcons
                  name={slide.icon === 'compass-rose' ? 'compass-rose' : 'star-shooting-outline'}
                  size={74}
                  color={colors.goldLight}
                />
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Bottom fade into canvas background */}
        <LinearGradient
          colors={['rgba(4,6,17,0)', colors.canvas]}
          style={styles.bottomFade}
        />
      </View>

      {/* Copy & Controls section */}
      <View
        style={[
          styles.contentSection,
          { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md },
        ]}
      >
        {isSlide4 ? (
          /* Slide 4: 3-line title, 5 decorative stars (hidden from screen readers), 1 line of app copy (§4.1) */
          <View style={styles.copyBlock}>
            <View style={styles.titleStack} accessibilityRole="header">
              <Text style={styles.titleLinePrimary}>{t(slide.titleLine1Key)}</Text>
              <LinearGradient
                colors={[...gradients.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientTextPill}
              >
                <Text style={styles.titleLineGradient}>
                  {t(slide.titleLine2Key)}
                </Text>
              </LinearGradient>
              {slide.titleLine3Key ? (
                <Text style={styles.titleLinePrimary}>{t(slide.titleLine3Key)}</Text>
              ) : null}
            </View>

            {/* 5 decorative stars — strictly hidden from screen readers (§4.1) */}
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden={true}
              aria-hidden={true}
              style={styles.starsRow}
            >
              {Array.from({ length: DECORATIVE_STAR_COUNT }).map((_, starIdx) => (
                <MaterialCommunityIcons
                  key={starIdx}
                  accessible={false}
                  importantForAccessibility="no"
                  name="star"
                  size={20}
                  color={colors.gold}
                />
              ))}
            </View>

            {/* 1 line of app copy — strictly app description, NEVER a fake user quote or review (§4.1, §9) */}
            <Text numberOfLines={2} style={styles.bodyCopy}>
              {t(slide.bodyKey)}
            </Text>
          </View>
        ) : (
          /* Slides 1–3: 2-line title (second line gradient) + 1 line of body (§4.1) */
          <View style={styles.copyBlock}>
            <View style={styles.titleStack} accessibilityRole="header">
              <Text style={styles.titleLinePrimary}>{t(slide.titleLine1Key)}</Text>
              <LinearGradient
                colors={[...gradients.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientTextPill}
              >
                <Text style={styles.titleLineGradient}>
                  {t(slide.titleLine2Key)}
                </Text>
              </LinearGradient>
            </View>

            <Text numberOfLines={2} style={styles.bodyCopy}>
              {t(slide.bodyKey)}
            </Text>
          </View>
        )}

        {/* 4 Page Dots + Next / Continue Button */}
        <View style={styles.footerControls}>
          <View
            style={styles.dotsRow}
            accessibilityRole="Adjustable"
            accessibilityLabel={`${clampedIndex + 1} / ${INTRO_SLIDE_COUNT}`}
          >
            {INTRO_SLIDES.map((item) => {
              const active = item.index === clampedIndex;
              return (
                <View
                  key={item.index}
                  style={[
                    styles.dot,
                    active ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              );
            })}
          </View>

          <Button
            label={t(slide.ctaKey)}
            onPress={handlePrimaryPress}
            size="lg"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  heroVisualContainer: {
    flex: 1.15,
    width: '100%',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    zIndex: 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  brandText: {
    ...type.eyebrow,
    color: colors.goldLight,
    letterSpacing: 2.5,
  },
  closeButton: {
    width: CLOSE_HIT_TARGET_PT,
    height: CLOSE_HIT_TARGET_PT,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(10,16,36,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPlaceholder: {
    width: CLOSE_HIT_TARGET_PT,
    height: CLOSE_HIT_TARGET_PT,
  },
  illustrationCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emblemHalo: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(231,199,119,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  previewCard: {
    flex: 1,
    minHeight: 132,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  previewCardCenter: {
    borderColor: colors.gold,
    transform: [{ translateY: -8 }],
  },
  previewIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.goldWashStrong,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCardLabel: {
    ...type.captionStrong,
    color: colors.ink,
    textAlign: 'center',
  },
  bottomFade: {
    height: 64,
    width: '100%',
  },
  contentSection: {
    flex: 0.85,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  copyBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  titleStack: {
    alignItems: 'center',
    gap: 4,
  },
  titleLinePrimary: {
    fontFamily: font.displayStrong,
    fontSize: 34,
    lineHeight: 38,
    color: colors.ink,
    textAlign: 'center',
  },
  gradientTextPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: radius.md,
  },
  titleLineGradient: {
    fontFamily: font.displayStrong,
    fontSize: 34,
    lineHeight: 38,
    color: colors.onGold,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  bodyCopy: {
    ...type.bodyMd,
    color: colors.mute,
    textAlign: 'center',
    maxWidth: 340,
  },
  footerControls: {
    gap: spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: radius.full,
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.gold,
  },
  dotInactive: {
    width: 8,
    backgroundColor: colors.glassBorder,
  },
});
