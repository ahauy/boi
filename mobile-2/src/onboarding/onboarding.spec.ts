import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs: any) => objs.android },
  BackHandler: {
    exitApp: vi.fn(),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  StyleSheet: {
    create: (s: any) => s,
    hairlineWidth: 1,
    absoluteFill: {},
  },
  View: 'View',
  Text: 'Text',
}));

vi.mock('expo-device', () => ({
  isDevice: true,
  modelName: 'Pixel 8',
  brand: 'google',
  supportedCpuArchitectures: ['arm64-v8a'],
}));

vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: vi.fn(async (k: string) => {
        store.delete(k);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});

import {
  INTRO_SLIDES,
  INTRO_SLIDE_COUNT,
  FUNNEL_SCREENS,
  FUNNEL_STEP_COUNT,
  MAX_FAVORITE_INSIGHTS,
  CONSENT_GATE_TIMEOUT_MS,
  CLOSE_HIT_TARGET_PT,
  DECORATIVE_STAR_COUNT,
  LARGE_FONT_SCALE_THRESHOLD,
  ONBOARDING_PROFILE_STORAGE_KEY,
  handleIntroNext,
  handleIntroClose,
  handleIntroBack,
  handleFunnelBack,
  advanceFunnelStep,
  canSkipFunnelStep,
  isFunnelStepSkippable,
  isFunnelStepRequired,
  canContinueFunnelStep,
  toggleFavoriteInsight,
  shouldShowFillSpaceAdInFunnel,
  getRadioGridColumns,
  getReservedAdSlotHeight,
  isConsentGateSettled,
  createInitialOnboardingAnswers,
  saveOnboardingProfile,
  loadOnboardingProfile,
  InsightOptionId,
} from './onboarding-machine';

import {
  checkDeviceIntegrity,
  isDeviceBlocked,
  resetIntegrityGate,
  setPlayIntegrityVerdict,
  ALLOWED_ANDROID_ABIS,
} from '../lib/integrity-gate';

describe('Phase 8 & 9: Onboarding Flow, Integrity Gate & Playbook Verification', () => {
  beforeEach(() => {
    resetIntegrityGate();
    vi.restoreAllMocks();
  });

  describe('1. Intro 4 Slides Transitions & Close Button on Slide 4 (Playbook §4.1, §9)', () => {
    it('verifies 4 slides configuration and copy safety policies', () => {
      expect(INTRO_SLIDES).toHaveLength(INTRO_SLIDE_COUNT);
      expect(INTRO_SLIDE_COUNT).toBe(4);

      // Verify each slide has valid keys and strictly forbids rating dialogs or store links
      for (const slide of INTRO_SLIDES) {
        expect(slide.titleLine1Key).toBeDefined();
        expect(slide.titleLine2Key).toBeDefined();
        expect(slide.bodyKey).toBeDefined();
        expect(slide.ctaKey).toBeDefined();
        expect(slide.triggersRatingDialog).toBe(false);
        expect(slide.opensStoreLink).toBe(false);
      }

      // Slide 4 specific showcase requirements (§4.1)
      const slide4 = INTRO_SLIDES[3];
      expect(slide4.kind).toBe('showcase');
      expect(slide4.titleLine3Key).toBeDefined();
      expect(slide4.decorativeStarCount).toBe(DECORATIVE_STAR_COUNT);
      expect(slide4.decorativeStarCount).toBe(5);
      expect(slide4.closeButtonSizePt).toBe(CLOSE_HIT_TARGET_PT);
      expect(slide4.closeButtonSizePt).toBe(44);
    });

    it('advances through slides 1..3 in intro phase and transitions to funnel at slide 4', () => {
      // Slide 1 (index 0) -> Slide 2 (index 1)
      expect(handleIntroNext(0)).toEqual({
        phase: 'intro',
        slideIndex: 1,
        funnelStep: 1,
      });

      // Slide 2 (index 1) -> Slide 3 (index 2)
      expect(handleIntroNext(1)).toEqual({
        phase: 'intro',
        slideIndex: 2,
        funnelStep: 1,
      });

      // Slide 3 (index 2) -> Slide 4 (index 3)
      expect(handleIntroNext(2)).toEqual({
        phase: 'intro',
        slideIndex: 3,
        funnelStep: 1,
      });

      // Slide 4 (index 3) CTA press -> transitions to funnel phase at step 1
      expect(handleIntroNext(3)).toEqual({
        phase: 'funnel',
        slideIndex: 3,
        funnelStep: 1,
      });
    });

    it('Slide 4 close button (handleIntroClose) transitions directly to funnel step 1', () => {
      const result = handleIntroClose();
      expect(result).toEqual({
        phase: 'funnel',
        slideIndex: 3,
        funnelStep: 1,
      });
    });

    it('supports navigating backwards across Intro slides 4 -> 3 -> 2 -> 1', () => {
      expect(handleIntroBack(3)).toEqual({
        action: 'prev_slide',
        nextSlideIndex: 2,
      });
      expect(handleIntroBack(2)).toEqual({
        action: 'prev_slide',
        nextSlideIndex: 1,
      });
      expect(handleIntroBack(1)).toEqual({
        action: 'prev_slide',
        nextSlideIndex: 0,
      });
    });
  });

  describe('2. Hardware Back Navigation & Funnel Transitions (Playbook §4.1, §4.2)', () => {
    it('exits app when pressing back on Intro Slide 1 (slideIndex 0 or lower)', () => {
      expect(handleIntroBack(0)).toEqual({
        action: 'exit_app',
        nextSlideIndex: 0,
      });
      expect(handleIntroBack(-1)).toEqual({
        action: 'exit_app',
        nextSlideIndex: 0,
      });
    });

    it('navigates from Funnel step 1 back to Intro Slide 4', () => {
      const backFromStep1 = handleFunnelBack(1);
      expect(backFromStep1).toEqual({
        phase: 'intro',
        slideIndex: 3,
        funnelStep: 1,
      });

      // Non-positive step also gracefully falls back to Intro slide 4
      expect(handleFunnelBack(0)).toEqual({
        phase: 'intro',
        slideIndex: 3,
        funnelStep: 1,
      });
    });

    it('navigates backwards through Funnel steps 8 down to 2 without leaving funnel phase', () => {
      for (let step = FUNNEL_STEP_COUNT; step >= 2; step--) {
        const backResult = handleFunnelBack(step);
        expect(backResult).toEqual({
          phase: 'funnel',
          slideIndex: 3,
          funnelStep: step - 1,
        });
      }
    });
  });

  describe('3. Funnel 8 Steps Progression, Skip Behavior & Multi-select (Playbook §4.2)', () => {
    it('verifies configuration of all 8 funnel screens', () => {
      expect(FUNNEL_SCREENS).toHaveLength(FUNNEL_STEP_COUNT);
      expect(FUNNEL_STEP_COUNT).toBe(8);

      // Screens 1-3 are required and not skippable
      expect(isFunnelStepRequired(1)).toBe(true);
      expect(isFunnelStepRequired(2)).toBe(true);
      expect(isFunnelStepRequired(3)).toBe(true);

      expect(canSkipFunnelStep(1)).toBe(false);
      expect(canSkipFunnelStep(2)).toBe(false);
      expect(canSkipFunnelStep(3)).toBe(false);
      expect(isFunnelStepSkippable(1)).toBe(false);
      expect(isFunnelStepSkippable(2)).toBe(false);
      expect(isFunnelStepSkippable(3)).toBe(false);

      // Screens 4-7 are optional and skippable
      for (let step = 4; step <= 7; step++) {
        expect(isFunnelStepRequired(step)).toBe(false);
        expect(canSkipFunnelStep(step)).toBe(true);
        expect(isFunnelStepSkippable(step)).toBe(true);
      }

      // Screen 8 is feature intro (not required, not skippable - user clicks "Get Started")
      expect(isFunnelStepRequired(8)).toBe(false);
      expect(canSkipFunnelStep(8)).toBe(false);
      expect(isFunnelStepSkippable(8)).toBe(false);
    });

    it('progresses through steps 1..7 and finishes at step 8', () => {
      for (let step = 1; step < FUNNEL_STEP_COUNT; step++) {
        const next = advanceFunnelStep(step);
        expect(next.completed).toBe(false);
        expect(next.nextStep).toBe(step + 1);
      }

      // Step 8 completes the onboarding funnel
      const step8Result = advanceFunnelStep(8);
      expect(step8Result.completed).toBe(true);
      expect(step8Result.nextStep).toBe(8);

      // Step > 8 stays completed
      const beyondResult = advanceFunnelStep(9);
      expect(beyondResult.completed).toBe(true);
      expect(beyondResult.nextStep).toBe(8);
    });

    it('enforces continue button availability on required steps', () => {
      const answers = createInitialOnboardingAnswers('en');
      // Step 1: language is set -> can continue
      expect(canContinueFunnelStep(1, answers)).toBe(true);
      expect(canContinueFunnelStep(1, { ...answers, language: '' as any })).toBe(false);

      // Step 2: requires gender selection
      expect(canContinueFunnelStep(2, answers)).toBe(false);
      expect(canContinueFunnelStep(2, { ...answers, gender: 'female' })).toBe(true);

      // Step 3: requires ageBand selection
      expect(canContinueFunnelStep(3, answers)).toBe(false);
      expect(canContinueFunnelStep(3, { ...answers, ageBand: '25-34' })).toBe(true);

      // Steps 4-8: can continue even without selection (optional or feature intro)
      for (let s = 4; s <= 8; s++) {
        expect(canContinueFunnelStep(s, answers)).toBe(true);
      }
    });

    it('toggles insights on Step 7 and enforces maximum of 5 selections', () => {
      expect(MAX_FAVORITE_INSIGHTS).toBe(5);

      let selected: InsightOptionId[] = [];

      // Add item1
      selected = toggleFavoriteInsight(selected, 'item1');
      expect(selected).toEqual(['item1']);

      // Add item2, item3, item4, item5
      selected = toggleFavoriteInsight(selected, 'item2');
      selected = toggleFavoriteInsight(selected, 'item3');
      selected = toggleFavoriteInsight(selected, 'item4');
      selected = toggleFavoriteInsight(selected, 'item5');
      expect(selected).toHaveLength(5);
      expect(selected).toEqual(['item1', 'item2', 'item3', 'item4', 'item5']);

      // Attempt to add a 6th item (item6) -> must be rejected (capped at 5)
      const rejected = toggleFavoriteInsight(selected, 'item6');
      expect(rejected).toHaveLength(5);
      expect(rejected).not.toContain('item6');
      expect(rejected).toEqual(['item1', 'item2', 'item3', 'item4', 'item5']);

      // Deselect item3
      selected = toggleFavoriteInsight(selected, 'item3');
      expect(selected).toHaveLength(4);
      expect(selected).not.toContain('item3');

      // Now item6 can be added
      selected = toggleFavoriteInsight(selected, 'item6');
      expect(selected).toHaveLength(5);
      expect(selected).toContain('item6');
    });

    it('handles fill-space ad visibility, responsive column layout & reserved ad container height', () => {
      // Screens 1-6 have fill-space ad; Screens 7-8 are banner-only
      for (let s = 1; s <= 6; s++) {
        expect(shouldShowFillSpaceAdInFunnel(s)).toBe(true);
      }
      expect(shouldShowFillSpaceAdInFunnel(7)).toBe(false);
      expect(shouldShowFillSpaceAdInFunnel(8)).toBe(false);

      // Responsive column layout based on fontScale
      expect(LARGE_FONT_SCALE_THRESHOLD).toBe(1.3);
      expect(getRadioGridColumns(1.0)).toBe(2);
      expect(getRadioGridColumns(1.29)).toBe(2);
      expect(getRadioGridColumns(1.3)).toBe(1);
      expect(getRadioGridColumns(1.5)).toBe(1);

      // Fixed reserved ad container height prevents Continue button jumping (§4.2, §11.7)
      expect(getReservedAdSlotHeight(800)).toBe(300);
      expect(getReservedAdSlotHeight(780)).toBe(300);
      expect(getReservedAdSlotHeight(779)).toBe(220);
      expect(getReservedAdSlotHeight(600)).toBe(220);
    });

    it('saves and loads onboarding answers locally on device only (§4.2: never sent to server)', async () => {
      const answers = createInitialOnboardingAnswers('vi');
      answers.gender = 'male';
      answers.ageBand = '25-34';
      answers.focus = 'career';
      answers.tradition = 'eastern';
      answers.dominantHand = 'right';
      answers.favoriteInsights = ['item1', 'item4'];

      await saveOnboardingProfile(answers);
      const loaded = await loadOnboardingProfile();

      expect(loaded).toBeDefined();
      expect(loaded?.language).toBe('vi');
      expect(loaded?.gender).toBe('male');
      expect(loaded?.ageBand).toBe('25-34');
      expect(loaded?.focus).toBe('career');
      expect(loaded?.tradition).toBe('eastern');
      expect(loaded?.dominantHand).toBe('right');
      expect(loaded?.favoriteInsights).toEqual(['item1', 'item4']);
      expect(loaded?.completedAt).toBeDefined();
      expect(new Date(loaded!.completedAt!).getTime()).not.toBeNaN();
    });
  });

  describe('4. First-Launch Ads Consent Gate Timeout & Settled Check (Playbook §3)', () => {
    it('defines 30-second timeout constant (§3)', () => {
      expect(CONSENT_GATE_TIMEOUT_MS).toBe(30_000);
    });

    it('isConsentGateSettled settles when ads are ready or failed', () => {
      expect(isConsentGateSettled('idle', false, false)).toBe(false);
      expect(isConsentGateSettled('loading', false, false)).toBe(false);
      expect(isConsentGateSettled('ready', false, false)).toBe(true);
      expect(isConsentGateSettled('failed', false, false)).toBe(true);
    });

    it('settles immediately if 30s timeout fires or device is blocked regardless of ads status', () => {
      // 30s timeout elapsed -> settled
      expect(isConsentGateSettled('idle', true, false)).toBe(true);
      expect(isConsentGateSettled('loading', true, false)).toBe(true);

      // Device blocked -> settled immediately so user is not stuck on spinner
      expect(isConsentGateSettled('idle', false, true)).toBe(true);
      expect(isConsentGateSettled('loading', false, true)).toBe(true);
    });
  });

  describe('5. Integrity Gate & Unauthorized Emulator Detection (Playbook §3, §11.12)', () => {
    it('allowed android ABIs include arm64-v8a, armeabi-v7a, and x86_64', () => {
      expect(ALLOWED_ANDROID_ABIS).toEqual(['arm64-v8a', 'armeabi-v7a', 'x86_64']);
    });

    it('allows execution in development mode or non-Android platforms', () => {
      const devResult = checkDeviceIntegrity({
        isDev: true,
        platformOs: 'android',
        isPhysicalDevice: false,
      });
      expect(devResult.passed).toBe(true);
      expect(devResult.blocked).toBe(false);
      expect(devResult.reason).toBe('ok');
      expect(isDeviceBlocked()).toBe(false);

      const iosResult = checkDeviceIntegrity({
        isDev: false,
        platformOs: 'ios',
        isPhysicalDevice: false,
      });
      expect(iosResult.passed).toBe(true);
      expect(iosResult.blocked).toBe(false);
      expect(iosResult.reason).toBe('ok');
    });

    it('blocks production Android emulator sideloads (§11.12)', () => {
      const emulatorResult = checkDeviceIntegrity({
        isDev: false,
        platformOs: 'android',
        isPhysicalDevice: false,
        allowEmulatorInProd: false,
        supportedAbis: ['x86_64'],
      });
      expect(emulatorResult.passed).toBe(false);
      expect(emulatorResult.blocked).toBe(true);
      expect(emulatorResult.reason).toBe('emulator_in_production');
      expect(isDeviceBlocked()).toBe(true);

      // If allowEmulatorInProd is explicitly set (e.g. testing CI build), allows emulator
      const allowedResult = checkDeviceIntegrity({
        isDev: false,
        platformOs: 'android',
        isPhysicalDevice: false,
        allowEmulatorInProd: true,
        supportedAbis: ['x86_64'],
        brand: 'google',
        modelName: 'Pixel 8',
      });
      expect(allowedResult.passed).toBe(true);
      expect(allowedResult.blocked).toBe(false);
      expect(allowedResult.reason).toBe('ok');
    });

    it('blocks devices with invalid or missing ABIs (Pitfall §11.12)', () => {
      const invalidAbiResult = checkDeviceIntegrity({
        isDev: false,
        platformOs: 'android',
        isPhysicalDevice: true,
        supportedAbis: ['mips', 'arm64-v8a-fake'],
      });
      expect(invalidAbiResult.passed).toBe(false);
      expect(invalidAbiResult.blocked).toBe(true);
      expect(invalidAbiResult.reason).toBe('invalid_abi');
      expect(isDeviceBlocked()).toBe(true);

      // Empty ABI list
      const emptyAbiResult = checkDeviceIntegrity({
        isDev: false,
        platformOs: 'android',
        isPhysicalDevice: true,
        supportedAbis: [],
      });
      expect(emptyAbiResult.passed).toBe(false);
      expect(emptyAbiResult.blocked).toBe(true);
      expect(emptyAbiResult.reason).toBe('invalid_abi');
    });

    it('detects spoofed emulator fingerprints claiming to be physical devices', () => {
      const spoofedFingerprints = [
        { brand: 'Google', modelName: 'sdk_gphone64_arm64' },
        { brand: 'Nox', modelName: 'NoxPlayer' },
        { brand: 'BlueStacks', modelName: 'BlueStacks_5' },
        { brand: 'Genymotion', modelName: 'Generic Phone' },
        { brand: 'microvirt', modelName: 'memu' },
        { brand: 'vbox86', modelName: 'Android-x86' },
      ];

      for (const fp of spoofedFingerprints) {
        resetIntegrityGate();
        const res = checkDeviceIntegrity({
          isDev: false,
          platformOs: 'android',
          isPhysicalDevice: true, // Claims to be physical device
          supportedAbis: ['arm64-v8a'],
          brand: fp.brand,
          modelName: fp.modelName,
          allowEmulatorInProd: false,
        });
        expect(res.passed).toBe(false);
        expect(res.blocked).toBe(true);
        expect(res.reason).toBe('spoofed_device_fingerprint');
        expect(isDeviceBlocked()).toBe(true);
      }
    });

    it('allows verified legitimate physical Android devices', () => {
      const physicalResult = checkDeviceIntegrity({
        isDev: false,
        platformOs: 'android',
        isPhysicalDevice: true,
        supportedAbis: ['arm64-v8a', 'armeabi-v7a'],
        brand: 'samsung',
        modelName: 'SM-S928B',
      });
      expect(physicalResult.passed).toBe(true);
      expect(physicalResult.blocked).toBe(false);
      expect(physicalResult.reason).toBe('ok');
      expect(isDeviceBlocked()).toBe(false);
    });

    it('blocks devices when Play Integrity verdict is FAILED', () => {
      setPlayIntegrityVerdict('FAILED');
      expect(isDeviceBlocked()).toBe(true);

      const res = checkDeviceIntegrity({
        isDev: true, // Even in dev, explicit Play Integrity FAILED blocks
        platformOs: 'android',
        isPhysicalDevice: true,
      });
      expect(res.passed).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.reason).toBe('play_integrity_failed');
    });
  });
});
