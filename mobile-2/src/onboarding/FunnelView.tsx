import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Text from '../components/AppText';
import CosmicBackground from '../components/CosmicBackground';
import CosmicHand from '../components/CosmicHand';
import { Button, ProgressBar } from '../components/ui';
import NativeAdSlot from '../ads/native-ad-slot';
import { useAdsStore } from '../ads/ads-store';
import { colors, radius, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';
import {
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  useI18n,
} from '../i18n';
import {
  AgeBandOption,
  FocusOption,
  FUNNEL_SCREENS,
  FUNNEL_STEP_COUNT,
  GenderOption,
  HandOption,
  InsightOptionId,
  MAX_FAVORITE_INSIGHTS,
  OnboardingAnswers,
  TraditionOption,
  canContinueFunnelStep,
  getRadioGridColumns,
  getReservedAdSlotHeight,
  isFunnelStepSkippable,
  shouldShowFillSpaceAdInFunnel,
} from './onboarding-machine';

export interface FunnelViewProps {
  step: number;
  answers: OnboardingAnswers;
  finishing?: boolean;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  onSelectGender: (gender: GenderOption) => void;
  onSelectAgeBand: (ageBand: AgeBandOption) => void;
  onSelectFocus: (focus: FocusOption) => void;
  onSelectTradition: (tradition: TraditionOption) => void;
  onSelectHand: (hand: HandOption) => void;
  onToggleInsight: (insight: InsightOptionId) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function FunnelView({
  step,
  answers,
  finishing = false,
  onSelectLanguage,
  onSelectGender,
  onSelectAgeBand,
  onSelectFocus,
  onSelectTradition,
  onSelectHand,
  onToggleInsight,
  onContinue,
  onSkip,
  onBack,
}: FunnelViewProps) {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const { bannerHeight } = useAdsStore();
  const { width, height, fontScale } = useWindowDimensions();
  const { t } = useI18n();

  const clampedStep = Math.max(1, Math.min(FUNNEL_STEP_COUNT, step));
  const screenSpec =
    FUNNEL_SCREENS.find((item) => item.step === clampedStep) ??
    FUNNEL_SCREENS[0];

  const columns = getRadioGridColumns(fontScale);
  const showFillSpaceAd = shouldShowFillSpaceAdInFunnel(clampedStep);
  const reservedAdHeight = getReservedAdSlotHeight(height);
  const skippable = isFunnelStepSkippable(clampedStep);
  const canContinue = canContinueFunnelStep(clampedStep, answers);
  const isFinalStep = clampedStep === FUNNEL_STEP_COUNT;

  const getSelectedSingleChoice = (): string | null => {
    switch (clampedStep) {
      case 2:
        return answers.gender;
      case 3:
        return answers.ageBand;
      case 4:
        return answers.focus;
      case 5:
        return answers.tradition;
      case 6:
        return answers.dominantHand;
      default:
        return null;
    }
  };

  const handleSelectSingleOption = (id: string) => {
    haptic.select();
    switch (clampedStep) {
      case 2:
        onSelectGender(id as GenderOption);
        break;
      case 3:
        onSelectAgeBand(id as AgeBandOption);
        break;
      case 4:
        onSelectFocus(id as FocusOption);
        break;
      case 5:
        onSelectTradition(id as TraditionOption);
        break;
      case 6:
        onSelectHand(id as HandOption);
        break;
    }
  };

  const selectedValue = getSelectedSingleChoice();

  // The root screen shrinks and grows with the banner below it. Sizing the content from the
  // frame keeps Continue in place whether the ad loads, fails or the banner collapses (§4.2).
  const contentStyle = showFillSpaceAd
    ? { height: frame.height - bannerHeight - insets.bottom }
    : styles.flexContent;

  return (
    <View style={styles.root}>
      <CosmicBackground />
      <View style={contentStyle}>

      {/* Header with back button, step progress bar, and optional Skip button (§4.2) */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.xs },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('reading.back')}
          onPress={() => {
            haptic.tap();
            onBack();
          }}
          hitSlop={8}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={colors.ink}
          />
        </Pressable>

        <View style={styles.progressWrapper}>
          <ProgressBar value={clampedStep / FUNNEL_STEP_COUNT} />
          <Text style={styles.stepIndicator}>
            {`${clampedStep} / ${FUNNEL_STEP_COUNT}`}
          </Text>
        </View>

        {skippable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.skip')}
            onPress={() => {
              haptic.tap();
              onSkip();
            }}
            hitSlop={8}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>{t('common.skip')}</Text>
          </Pressable>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      {/* 1. ANSWERS AREA (flex: 1) — Scrollable so Continue button below stays at a fixed vertical band (§4.2, §11.7) */}
      <View style={styles.answersArea}>
        <ScrollView
          contentContainerStyle={styles.answersScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headingBlock}>
            <Text style={styles.title} accessibilityRole="header">
              {t(screenSpec.titleKey)}
            </Text>
            <Text style={styles.subtitle}>{t(screenSpec.subtitleKey)}</Text>
          </View>

          {/* Screen 1: Language selection (9 languages, each in its own native language) */}
          {screenSpec.kind === 'language' && (
            <View
              accessibilityRole="radiogroup"
              style={[
                styles.gridContainer,
                columns === 1 && styles.gridSingleColumn,
              ]}
            >
              {SUPPORTED_LANGUAGES.map((lang) => {
                const checked = answers.language === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    accessibilityRole="radio"
                    accessibilityLabel={lang.nativeName}
                    accessibilityState={{ checked }}
                    aria-checked={checked}
                    onPress={() => {
                      haptic.select();
                      onSelectLanguage(lang.code);
                    }}
                    style={[
                      styles.gridItem,
                      columns === 1 ? styles.gridItemFull : styles.gridItemHalf,
                    ]}
                  >
                    <LinearGradient
                      colors={
                        checked
                          ? ['rgba(231,199,119,0.22)', 'rgba(26,38,75,0.92)']
                          : ['rgba(20,30,62,0.65)', 'rgba(8,13,30,0.82)']
                      }
                      style={[
                        styles.optionCard,
                        checked && styles.optionCardSelected,
                      ]}
                    >
                      <Text style={styles.flagEmoji} accessible={false}>
                        {lang.flag}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.optionLabel,
                          checked && styles.optionLabelSelected,
                        ]}
                      >
                        {lang.nativeName}
                      </Text>
                      <MaterialCommunityIcons
                        accessible={false}
                        name={checked ? 'radiobox-marked' : 'radiobox-blank'}
                        size={18}
                        color={checked ? colors.gold : colors.stone}
                      />
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Screens 2–6: Single-choice 2-column radio cards with icons (1 column when fontScale >= 1.3) */}
          {screenSpec.kind === 'single_choice' && screenSpec.options && (
            <View
              accessibilityRole="radiogroup"
              style={[
                styles.gridContainer,
                columns === 1 && styles.gridSingleColumn,
              ]}
            >
              {screenSpec.options.map((opt) => {
                const checked = selectedValue === opt.id;
                const label = t(opt.labelKey);
                return (
                  <Pressable
                    key={opt.id}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked }}
                    aria-checked={checked}
                    onPress={() => handleSelectSingleOption(opt.id)}
                    style={[
                      styles.gridItem,
                      columns === 1 ? styles.gridItemFull : styles.gridItemHalf,
                    ]}
                  >
                    <LinearGradient
                      colors={
                        checked
                          ? ['rgba(231,199,119,0.22)', 'rgba(26,38,75,0.92)']
                          : ['rgba(20,30,62,0.65)', 'rgba(8,13,30,0.82)']
                      }
                      style={[
                        styles.radioCard,
                        checked && styles.optionCardSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.radioIconCircle,
                          checked && styles.radioIconCircleSelected,
                        ]}
                      >
                        <MaterialCommunityIcons
                          accessible={false}
                          name={opt.icon as any}
                          size={22}
                          color={checked ? colors.goldLight : colors.mute}
                        />
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.radioCardLabel,
                          checked && styles.optionLabelSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Age confirmation note on Screen 3 (§4.2, §13) */}
          {clampedStep === 3 && (
            <View style={styles.ageNoticeContainer}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={16}
                color={colors.gold}
              />
              <Text style={styles.ageNoticeText}>
                {t('funnel.step3.ageNotice')}
              </Text>
            </View>
          )}

          {/* Screen 7: Pick up to 5 favourite palmistry insights (multi-select, banner only) */}
          {screenSpec.kind === 'multi_choice' && screenSpec.options && (
            <View style={styles.multiChoiceWrapper}>
              <Text style={styles.selectionCounter}>
                {`${answers.favoriteInsights.length} / ${MAX_FAVORITE_INSIGHTS}`}
              </Text>
              <View
                style={[
                  styles.gridContainer,
                  columns === 1 && styles.gridSingleColumn,
                ]}
              >
                {screenSpec.options.map((opt) => {
                  const checked = answers.favoriteInsights.includes(
                    opt.id as InsightOptionId
                  );
                  const atMax =
                    !checked &&
                    answers.favoriteInsights.length >= MAX_FAVORITE_INSIGHTS;
                  const label = t(opt.labelKey);
                  return (
                    <Pressable
                      key={opt.id}
                      accessibilityRole="checkbox"
                      accessibilityLabel={label}
                      accessibilityState={{ checked, disabled: atMax }}
                      aria-checked={checked}
                      onPress={() => {
                        if (atMax) return;
                        haptic.select();
                        onToggleInsight(opt.id as InsightOptionId);
                      }}
                      style={[
                        styles.gridItem,
                        columns === 1
                          ? styles.gridItemFull
                          : styles.gridItemHalf,
                        atMax && styles.disabledOption,
                      ]}
                    >
                      <LinearGradient
                        colors={
                          checked
                            ? ['rgba(231,199,119,0.22)', 'rgba(26,38,75,0.92)']
                            : ['rgba(20,30,62,0.65)', 'rgba(8,13,30,0.82)']
                        }
                        style={[
                          styles.radioCard,
                          checked && styles.optionCardSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.radioIconCircle,
                            checked && styles.radioIconCircleSelected,
                          ]}
                        >
                          <MaterialCommunityIcons
                            accessible={false}
                            name={opt.icon as any}
                            size={22}
                            color={checked ? colors.goldLight : colors.mute}
                          />
                        </View>
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.radioCardLabel,
                            checked && styles.optionLabelSelected,
                          ]}
                        >
                          {label}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Screen 8: Main AI Palm Reading feature intro + Get started (banner only) */}
          {screenSpec.kind === 'feature_intro' && (
            <View style={styles.featureIntroContainer}>
              <CosmicHand size={Math.min(width * 0.52, 200)} />
              <View style={styles.featurePills}>
                {[
                  { icon: 'hand-extended-outline' as const, labelKey: 'funnel.step7.item1' as const },
                  { icon: 'head-lightbulb-outline' as const, labelKey: 'funnel.step7.item2' as const },
                  { icon: 'timeline-clock-outline' as const, labelKey: 'funnel.step7.item3' as const },
                ].map((feature) => (
                  <View key={feature.labelKey} style={styles.featurePillRow}>
                    <MaterialCommunityIcons
                      name={feature.icon}
                      size={18}
                      color={colors.gold}
                    />
                    <Text style={styles.featurePillText}>
                      {t(feature.labelKey)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* 2. HELPER + CONTINUE BUTTON BAND — Fixed vertical band centred between answers and ad slot (§4.2, §11.7) */}
      <View
        style={[
          styles.actionBand,
          !showFillSpaceAd && {
            paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md,
          },
        ]}
      >
        <Button
          label={isFinalStep ? t('common.getStarted') : t('common.continue')}
          onPress={() => {
            if (!canContinue || finishing) return;
            haptic.tap();
            onContinue();
          }}
          disabled={!canContinue}
          loading={finishing}
          size="lg"
        />
      </View>

      {/* 3. FILL-SPACE AD SLOT (Screens 1–6 ONLY) — Fixed reserved height so Continue NEVER jumps (§4.2, §11.7) */}
      {showFillSpaceAd ? (
        <View
          style={[
            styles.reservedAdContainer,
            {
              height: reservedAdHeight,
              paddingBottom: spacing.xs,
            },
          ]}
        >
          <NativeAdSlot
            key={`funnel-ad-${clampedStep}`}
            availableHeight={reservedAdHeight}
            availableWidth={Math.max(300, width - spacing.xl * 2)}
          />
        </View>
      ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  flexContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  stepIndicator: {
    ...type.code,
    color: colors.stone,
    fontSize: 11,
  },
  skipBtn: {
    minWidth: 56,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  skipText: {
    ...type.captionStrong,
    color: colors.goldLight,
  },
  skipPlaceholder: {
    width: 56,
    height: 44,
  },
  answersArea: {
    flex: 1,
  },
  answersScrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headingBlock: {
    gap: 4,
  },
  title: {
    ...type.headingMd,
    color: colors.ink,
  },
  subtitle: {
    ...type.caption,
    color: colors.mute,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridSingleColumn: {
    flexDirection: 'column',
  },
  gridItem: {
    borderRadius: radius.xl,
  },
  gridItemHalf: {
    width: '48%',
    flexGrow: 1,
  },
  gridItemFull: {
    width: '100%',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  radioCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  optionCardSelected: {
    borderColor: colors.gold,
  },
  radioIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioIconCircleSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.goldWashStrong,
  },
  flagEmoji: {
    fontSize: 18,
  },
  optionLabel: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
    fontSize: 14,
  },
  radioCardLabel: {
    ...type.captionStrong,
    color: colors.ink,
    textAlign: 'center',
    fontSize: 13,
  },
  optionLabelSelected: {
    color: colors.goldLight,
  },
  multiChoiceWrapper: {
    gap: spacing.sm,
  },
  selectionCounter: {
    ...type.code,
    color: colors.goldLight,
    textAlign: 'right',
  },
  disabledOption: {
    opacity: 0.45,
  },
  featureIntroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  featurePills: {
    width: '100%',
    gap: spacing.sm,
  },
  featurePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
  },
  featurePillText: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  actionBand: {
    height: 72,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  reservedAdContainer: {
    width: '100%',
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ageNoticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(231,199,119,0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(231,199,119,0.2)',
  },
  ageNoticeText: {
    ...type.caption,
    color: colors.stone,
    textAlign: 'center',
    flexShrink: 1,
  },
});
