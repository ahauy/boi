import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupportedLanguage, TranslationKey } from '../i18n';

/**
 * Onboarding State Machine & Pure Logic (Playbook §3, §4.1, §4.2, §9, §11.7)
 */

export const CONSENT_GATE_TIMEOUT_MS = 30_000;
export const INTRO_SLIDE_COUNT = 4;
export const FUNNEL_STEP_COUNT = 8;
export const MAX_FAVORITE_INSIGHTS = 5;
export const LARGE_FONT_SCALE_THRESHOLD = 1.3;
export const DECORATIVE_STAR_COUNT = 5;
export const CLOSE_HIT_TARGET_PT = 44;

export const ONBOARDING_PROFILE_STORAGE_KEY = 'palmsight.onboardingProfile';

export type OnboardingPhase = 'consent_loading' | 'intro' | 'funnel';

export type GenderOption = 'female' | 'male' | 'nonBinary' | 'preferNot';
export type AgeBandOption = '16-24' | '25-34' | '35-54' | '55+';
export type FocusOption = 'love' | 'career' | 'finance' | 'health';
export type TraditionOption = 'western' | 'eastern' | 'vedic' | 'all';
export type HandOption = 'right' | 'left' | 'both';
export type InsightOptionId = 'item1' | 'item2' | 'item3' | 'item4' | 'item5' | 'item6';

export interface OnboardingAnswers {
  language: SupportedLanguage;
  gender: GenderOption | null;
  ageBand: AgeBandOption | null;
  focus: FocusOption | null;
  tradition: TraditionOption | null;
  dominantHand: HandOption | null;
  favoriteInsights: InsightOptionId[];
  completedAt?: string;
}

export interface IntroSlideSpec {
  index: number;
  kind: 'standard' | 'showcase';
  titleLine1Key: TranslationKey;
  titleLine2Key: TranslationKey;
  titleLine3Key?: TranslationKey;
  bodyKey: TranslationKey;
  ctaKey: TranslationKey;
  icon: 'hand-extended-outline' | 'compass-rose' | 'star-shooting-outline' | 'sparkles';
  gradientColors: readonly [string, string, string];
  featurePreviewIcons?: readonly ['compass-outline', 'yin-yang', 'star-four-points-outline'];
  decorativeStarCount?: number;
  closeButtonSizePt?: number;
  triggersRatingDialog: false;
  opensStoreLink: false;
}

export const INTRO_SLIDES: readonly IntroSlideSpec[] = [
  {
    index: 0,
    kind: 'standard',
    titleLine1Key: 'intro.slide1.title1',
    titleLine2Key: 'intro.slide1.title2',
    bodyKey: 'intro.slide1.body',
    ctaKey: 'common.next',
    icon: 'hand-extended-outline',
    gradientColors: ['rgba(124,108,246,0.42)', 'rgba(19,29,61,0.85)', '#040611'],
    triggersRatingDialog: false,
    opensStoreLink: false,
  },
  {
    index: 1,
    kind: 'standard',
    titleLine1Key: 'intro.slide2.title1',
    titleLine2Key: 'intro.slide2.title2',
    bodyKey: 'intro.slide2.body',
    ctaKey: 'common.next',
    icon: 'compass-rose',
    gradientColors: ['rgba(231,199,119,0.34)', 'rgba(19,29,61,0.85)', '#040611'],
    triggersRatingDialog: false,
    opensStoreLink: false,
  },
  {
    index: 2,
    kind: 'standard',
    titleLine1Key: 'intro.slide3.title1',
    titleLine2Key: 'intro.slide3.title2',
    bodyKey: 'intro.slide3.body',
    ctaKey: 'common.next',
    icon: 'star-shooting-outline',
    gradientColors: ['rgba(56,189,178,0.30)', 'rgba(19,29,61,0.85)', '#040611'],
    triggersRatingDialog: false,
    opensStoreLink: false,
  },
  {
    index: 3,
    kind: 'showcase',
    titleLine1Key: 'intro.slide4.title1',
    titleLine2Key: 'intro.slide4.title2',
    titleLine3Key: 'intro.slide4.title3',
    bodyKey: 'intro.slide4.body',
    ctaKey: 'common.continue',
    icon: 'sparkles',
    gradientColors: ['rgba(231,199,119,0.38)', 'rgba(124,108,246,0.28)', '#040611'],
    featurePreviewIcons: ['compass-outline', 'yin-yang', 'star-four-points-outline'],
    decorativeStarCount: DECORATIVE_STAR_COUNT,
    closeButtonSizePt: CLOSE_HIT_TARGET_PT,
    triggersRatingDialog: false,
    opensStoreLink: false,
  },
] as const;

export interface FunnelChoiceOption<T extends string = string> {
  id: T;
  labelKey: TranslationKey;
  icon: string;
}

export interface FunnelScreenSpec {
  step: number;
  kind: 'language' | 'single_choice' | 'multi_choice' | 'feature_intro';
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  required: boolean;
  skippable: boolean;
  hasFillSpaceAd: boolean;
  options?: readonly FunnelChoiceOption[];
}

export const GENDER_OPTIONS: readonly FunnelChoiceOption<GenderOption>[] = [
  { id: 'female', labelKey: 'funnel.step2.female', icon: 'gender-female' },
  { id: 'male', labelKey: 'funnel.step2.male', icon: 'gender-male' },
  { id: 'nonBinary', labelKey: 'funnel.step2.nonBinary', icon: 'gender-non-binary' },
  { id: 'preferNot', labelKey: 'funnel.step2.preferNot', icon: 'shield-account-outline' },
] as const;

export const AGE_BAND_OPTIONS: readonly FunnelChoiceOption<AgeBandOption>[] = [
  { id: '16-24', labelKey: 'funnel.step3.age16_24', icon: 'sprout-outline' },
  { id: '25-34', labelKey: 'funnel.step3.age25_34', icon: 'white-balance-sunny' },
  { id: '35-54', labelKey: 'funnel.step3.age35_54', icon: 'compass-outline' },
  { id: '55+', labelKey: 'funnel.step3.age55_plus', icon: 'crown-outline' },
] as const;

export const FOCUS_OPTIONS: readonly FunnelChoiceOption<FocusOption>[] = [
  { id: 'love', labelKey: 'funnel.step4.love', icon: 'heart-outline' },
  { id: 'career', labelKey: 'funnel.step4.career', icon: 'briefcase-outline' },
  { id: 'finance', labelKey: 'funnel.step4.finance', icon: 'diamond-stone' },
  { id: 'health', labelKey: 'funnel.step4.health', icon: 'leaf' },
] as const;

export const TRADITION_OPTIONS: readonly FunnelChoiceOption<TraditionOption>[] = [
  { id: 'western', labelKey: 'funnel.step5.western', icon: 'weather-sunny' },
  { id: 'eastern', labelKey: 'funnel.step5.eastern', icon: 'yin-yang' },
  { id: 'vedic', labelKey: 'funnel.step5.vedic', icon: 'star-four-points-outline' },
  { id: 'all', labelKey: 'funnel.step5.all', icon: 'earth' },
] as const;

export const HAND_OPTIONS: readonly FunnelChoiceOption<HandOption>[] = [
  { id: 'right', labelKey: 'funnel.step6.right', icon: 'hand-back-right-outline' },
  { id: 'left', labelKey: 'funnel.step6.left', icon: 'hand-back-left-outline' },
  { id: 'both', labelKey: 'funnel.step6.both', icon: 'hand-clap' },
] as const;

export const INSIGHT_OPTIONS: readonly FunnelChoiceOption<InsightOptionId>[] = [
  { id: 'item1', labelKey: 'funnel.step7.item1', icon: 'heart-pulse' },
  { id: 'item2', labelKey: 'funnel.step7.item2', icon: 'head-lightbulb-outline' },
  { id: 'item3', labelKey: 'funnel.step7.item3', icon: 'timeline-clock-outline' },
  { id: 'item4', labelKey: 'funnel.step7.item4', icon: 'compass-rose' },
  { id: 'item5', labelKey: 'funnel.step7.item5', icon: 'hand-peace' },
  { id: 'item6', labelKey: 'funnel.step7.item6', icon: 'orbit' },
] as const;

export const FUNNEL_SCREENS: readonly FunnelScreenSpec[] = [
  {
    step: 1,
    kind: 'language',
    titleKey: 'funnel.step1.title',
    subtitleKey: 'funnel.step1.subtitle',
    required: true,
    skippable: false,
    hasFillSpaceAd: true,
  },
  {
    step: 2,
    kind: 'single_choice',
    titleKey: 'funnel.step2.title',
    subtitleKey: 'funnel.step2.subtitle',
    required: true,
    skippable: false,
    hasFillSpaceAd: true,
    options: GENDER_OPTIONS,
  },
  {
    step: 3,
    kind: 'single_choice',
    titleKey: 'funnel.step3.title',
    subtitleKey: 'funnel.step3.subtitle',
    required: true,
    skippable: false,
    hasFillSpaceAd: true,
    options: AGE_BAND_OPTIONS,
  },
  {
    step: 4,
    kind: 'single_choice',
    titleKey: 'funnel.step4.title',
    subtitleKey: 'funnel.step4.subtitle',
    required: false,
    skippable: true,
    hasFillSpaceAd: true,
    options: FOCUS_OPTIONS,
  },
  {
    step: 5,
    kind: 'single_choice',
    titleKey: 'funnel.step5.title',
    subtitleKey: 'funnel.step5.subtitle',
    required: false,
    skippable: true,
    hasFillSpaceAd: true,
    options: TRADITION_OPTIONS,
  },
  {
    step: 6,
    kind: 'single_choice',
    titleKey: 'funnel.step6.title',
    subtitleKey: 'funnel.step6.subtitle',
    required: false,
    skippable: true,
    hasFillSpaceAd: true,
    options: HAND_OPTIONS,
  },
  {
    step: 7,
    kind: 'multi_choice',
    titleKey: 'funnel.step7.title',
    subtitleKey: 'funnel.step7.subtitle',
    required: false,
    skippable: true,
    hasFillSpaceAd: false,
    options: INSIGHT_OPTIONS,
  },
  {
    step: 8,
    kind: 'feature_intro',
    titleKey: 'funnel.step8.title',
    subtitleKey: 'funnel.step8.subtitle',
    required: false,
    skippable: false,
    hasFillSpaceAd: false,
  },
] as const;

export function createInitialOnboardingAnswers(
  initialLanguage: SupportedLanguage = 'en'
): OnboardingAnswers {
  return {
    language: initialLanguage,
    gender: null,
    ageBand: null,
    focus: null,
    tradition: null,
    dominantHand: null,
    favoriteInsights: [],
  };
}

/**
 * Determines whether the first-launch ads consent loading gate has settled (§3).
 * Settles when ads status is 'ready' or 'failed', when 30s timeout fires, or if device is blocked.
 */
export function isConsentGateSettled(
  adsStatus: string,
  timedOut: boolean,
  deviceBlocked: boolean = false
): boolean {
  if (deviceBlocked || timedOut) return true;
  return adsStatus === 'ready' || adsStatus === 'failed';
}

/**
 * Android hardware Back button behavior during Intro (Playbook §4.1):
 * - Slides 2–4 (index 1..3): go back one slide.
 * - Slide 1 (index 0): exit the app (`BackHandler.exitApp()`).
 */
export function handleIntroBack(
  slideIndex: number
): { action: 'prev_slide' | 'exit_app'; nextSlideIndex: number } {
  if (slideIndex <= 0) {
    return { action: 'exit_app', nextSlideIndex: 0 };
  }
  return {
    action: 'prev_slide',
    nextSlideIndex: Math.max(0, slideIndex - 1),
  };
}

/**
 * Advances from the current Intro slide.
 * Slides 1–3 advance to the next slide; Slide 4 opens the 8-screen funnel at step 1 (§4.1).
 */
export function handleIntroNext(
  slideIndex: number
): { phase: 'intro' | 'funnel'; slideIndex: number; funnelStep: number } {
  if (slideIndex < INTRO_SLIDE_COUNT - 1) {
    return {
      phase: 'intro',
      slideIndex: slideIndex + 1,
      funnelStep: 1,
    };
  }
  return {
    phase: 'funnel',
    slideIndex: INTRO_SLIDE_COUNT - 1,
    funnelStep: 1,
  };
}

/**
 * Slide 4 close (X) button action: transitions directly into the 8-screen funnel (§4.1).
 * Never opens a rating dialog or store link.
 */
export function handleIntroClose(): {
  phase: 'funnel';
  slideIndex: number;
  funnelStep: 1;
} {
  return {
    phase: 'funnel',
    slideIndex: INTRO_SLIDE_COUNT - 1,
    funnelStep: 1,
  };
}

export function isFunnelStepRequired(step: number): boolean {
  const spec = FUNNEL_SCREENS.find((s) => s.step === step);
  return Boolean(spec?.required);
}

export function isFunnelStepSkippable(step: number): boolean {
  const spec = FUNNEL_SCREENS.find((s) => s.step === step);
  return Boolean(spec?.skippable);
}

export const canSkipFunnelStep = isFunnelStepSkippable;

/**
 * Funnel screens 1–6 have a fill-space ad slot under Continue; screens 7 & 8 are banner-only (§4.2).
 */
export function shouldShowFillSpaceAdInFunnel(step: number): boolean {
  const spec = FUNNEL_SCREENS.find((s) => s.step === step);
  return Boolean(spec?.hasFillSpaceAd);
}

/**
 * Single-choice screens use 2-column radio cards, switching to 1 column at large text sizes (§4.2).
 */
export function getRadioGridColumns(fontScale: number): 1 | 2 {
  return fontScale >= LARGE_FONT_SCALE_THRESHOLD ? 1 : 2;
}

/**
 * Computes the fixed reserved container height for the bottom fill-space ad slot on Funnel screens 1–6.
 * This height is constant for a given screen size so the Continue button NEVER shifts when the ad loads or fails (§4.2, §11.7).
 */
export function getReservedAdSlotHeight(windowHeight: number): number {
  return windowHeight >= 780 ? 300 : 220;
}

/**
 * Toggles an insight item on Screen 7, enforcing at most 5 selections (§4.2).
 */
export function toggleFavoriteInsight(
  current: readonly InsightOptionId[],
  itemId: InsightOptionId
): InsightOptionId[] {
  if (current.includes(itemId)) {
    return current.filter((id) => id !== itemId);
  }
  if (current.length >= MAX_FAVORITE_INSIGHTS) {
    return [...current];
  }
  return [...current, itemId];
}

/**
 * Checks whether the primary Continue / Get started button is enabled on the given funnel step.
 */
export function canContinueFunnelStep(
  step: number,
  answers: OnboardingAnswers
): boolean {
  switch (step) {
    case 1:
      return Boolean(answers.language);
    case 2:
      return answers.gender !== null;
    case 3:
      return answers.ageBand !== null;
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
      return true;
    default:
      return false;
  }
}

/**
 * Advances to the next funnel screen or marks the funnel complete after Screen 8.
 */
export function advanceFunnelStep(
  step: number
): { completed: boolean; nextStep: number } {
  if (step >= FUNNEL_STEP_COUNT) {
    return { completed: true, nextStep: FUNNEL_STEP_COUNT };
  }
  return { completed: false, nextStep: step + 1 };
}

/**
 * Handles back navigation inside the 8-screen funnel.
 * Step 1 returns to Intro Slide 4; Steps 2–8 return to the previous funnel step.
 */
export function handleFunnelBack(
  step: number
): { phase: 'intro' | 'funnel'; slideIndex: number; funnelStep: number } {
  if (step <= 1) {
    return {
      phase: 'intro',
      slideIndex: INTRO_SLIDE_COUNT - 1,
      funnelStep: 1,
    };
  }
  return {
    phase: 'funnel',
    slideIndex: INTRO_SLIDE_COUNT - 1,
    funnelStep: step - 1,
  };
}

/**
 * Stores onboarding answers locally on the device only (§4.2: never sent to server).
 */
export async function saveOnboardingProfile(
  answers: OnboardingAnswers
): Promise<void> {
  const payload: OnboardingAnswers = {
    ...answers,
    completedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(
    ONBOARDING_PROFILE_STORAGE_KEY,
    JSON.stringify(payload)
  );
}

/**
 * Loads locally stored onboarding answers if available.
 */
export async function loadOnboardingProfile(): Promise<OnboardingAnswers | null> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingAnswers;
  } catch {
    return null;
  }
}
