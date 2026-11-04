import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  View,
} from 'react-native';

import Text from '../components/AppText';
import CosmicBackground from '../components/CosmicBackground';
import CosmicHand from '../components/CosmicHand';
import { colors, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';
import { checkDeviceIntegrity, isDeviceBlocked } from '../lib/integrity-gate';
import { initializeAds } from '../ads/ads-service';
import { useAdsStore } from '../ads/ads-store';
import { SupportedLanguage, useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';
import IntroView from '../onboarding/IntroView';
import FunnelView from '../onboarding/FunnelView';
import {
  advanceFunnelStep,
  AgeBandOption,
  CONSENT_GATE_TIMEOUT_MS,
  createInitialOnboardingAnswers,
  FocusOption,
  GenderOption,
  handleFunnelBack,
  handleIntroBack,
  handleIntroClose,
  handleIntroNext,
  HandOption,
  InsightOptionId,
  isConsentGateSettled,
  OnboardingAnswers,
  toggleFavoriteInsight,
  TraditionOption,
} from '../onboarding/onboarding-machine';

export default function OnboardingScreen() {
  const { complete } = useOnboarding();
  const { language, setLanguage, t } = useI18n();
  const adsState = useAdsStore();

  // First-launch Ads Consent Loading Gate (§3)
  const [consentTimedOut, setConsentTimedOut] = useState(false);
  const [consentPromiseDone, setConsentPromiseDone] = useState(false);
  const [deviceBlocked, setDeviceBlocked] = useState(false);

  // In-memory only slide & funnel positions (§4.1)
  const [phase, setPhase] = useState<'intro' | 'funnel'>('intro');
  const [introSlideIndex, setIntroSlideIndex] = useState(0);
  const [funnelStep, setFunnelStep] = useState(1);
  const [finishing, setFinishing] = useState(false);

  const [answers, setAnswers] = useState<OnboardingAnswers>(() =>
    createInitialOnboardingAnswers(language)
  );

  // Sync initial language into answers if loaded from storage
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- language arrives async from storage
    setAnswers((prev) => ({ ...prev, language }));
  }, [language]);

  // Run Emulator / Play Integrity gate -> start Ads consent flow with 30s timeout (§3)
  useEffect(() => {
    let active = true;
    const integrity = checkDeviceIntegrity();
    if (integrity.blocked || isDeviceBlocked()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the integrity check is a device read
      setDeviceBlocked(true);
      setConsentPromiseDone(true);
      return;
    }

    const timer = setTimeout(() => {
      if (active) {
        setConsentTimedOut(true);
      }
    }, CONSENT_GATE_TIMEOUT_MS);

    void initializeAds().finally(() => {
      if (active) {
        setConsentPromiseDone(true);
      }
    });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const consentSettled =
    consentPromiseDone ||
    isConsentGateSettled(adsState.status, consentTimedOut, deviceBlocked);

  // Android hardware Back button handling (§4.1)
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!consentSettled) {
          BackHandler.exitApp();
          return true;
        }

        if (phase === 'intro') {
          const result = handleIntroBack(introSlideIndex);
          if (result.action === 'exit_app') {
            BackHandler.exitApp();
            return true;
          }
          setIntroSlideIndex(result.nextSlideIndex);
          return true;
        }

        const funnelBack = handleFunnelBack(funnelStep);
        setPhase(funnelBack.phase);
        setIntroSlideIndex(funnelBack.slideIndex);
        setFunnelStep(funnelBack.funnelStep);
        return true;
      }
    );

    return () => subscription.remove();
  }, [consentSettled, phase, introSlideIndex, funnelStep]);

  const onIntroNext = useCallback(() => {
    const nextState = handleIntroNext(introSlideIndex);
    setPhase(nextState.phase);
    setIntroSlideIndex(nextState.slideIndex);
    setFunnelStep(nextState.funnelStep);
  }, [introSlideIndex]);

  const onIntroCloseSlide4 = useCallback(() => {
    const nextState = handleIntroClose();
    setPhase(nextState.phase);
    setIntroSlideIndex(nextState.slideIndex);
    setFunnelStep(nextState.funnelStep);
  }, []);

  const handleSelectLanguage = useCallback(
    (nextLang: SupportedLanguage) => {
      setAnswers((prev) => ({ ...prev, language: nextLang }));
      void setLanguage(nextLang);
    },
    [setLanguage]
  );

  const handleSelectGender = useCallback((gender: GenderOption) => {
    setAnswers((prev) => ({ ...prev, gender }));
  }, []);

  const handleSelectAgeBand = useCallback((ageBand: AgeBandOption) => {
    setAnswers((prev) => ({ ...prev, ageBand }));
  }, []);

  const handleSelectFocus = useCallback((focus: FocusOption) => {
    setAnswers((prev) => ({ ...prev, focus }));
  }, []);

  const handleSelectTradition = useCallback((tradition: TraditionOption) => {
    setAnswers((prev) => ({ ...prev, tradition }));
  }, []);

  const handleSelectHand = useCallback((dominantHand: HandOption) => {
    setAnswers((prev) => ({ ...prev, dominantHand }));
  }, []);

  const handleToggleInsight = useCallback((insight: InsightOptionId) => {
    setAnswers((prev) => ({
      ...prev,
      favoriteInsights: toggleFavoriteInsight(prev.favoriteInsights, insight),
    }));
  }, []);

  const finishOnboarding = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    haptic.success();
    await complete(answers);
  }, [finishing, complete, answers]);

  const handleFunnelAdvance = useCallback(() => {
    const next = advanceFunnelStep(funnelStep);
    if (next.completed) {
      void finishOnboarding();
    } else {
      setFunnelStep(next.nextStep);
    }
  }, [funnelStep, finishOnboarding]);

  const handleFunnelBackPress = useCallback(() => {
    const back = handleFunnelBack(funnelStep);
    setPhase(back.phase);
    setIntroSlideIndex(back.slideIndex);
    setFunnelStep(back.funnelStep);
  }, [funnelStep]);

  // 1. First-launch Ads Consent Loading Gate (§3)
  if (!consentSettled) {
    return (
      <View style={styles.loadingRoot} accessibilityRole="progressbar">
        <CosmicBackground />
        <View style={styles.loadingContent}>
          <CosmicHand size={140} />
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  // 2. 4-Slide Intro (§4.1)
  if (phase === 'intro') {
    return (
      <IntroView
        slideIndex={introSlideIndex}
        onNext={onIntroNext}
        onCloseSlide4={onIntroCloseSlide4}
      />
    );
  }

  // 3. 8-Screen Onboarding Funnel (§4.2)
  return (
    <FunnelView
      step={funnelStep}
      answers={answers}
      finishing={finishing}
      onSelectLanguage={handleSelectLanguage}
      onSelectGender={handleSelectGender}
      onSelectAgeBand={handleSelectAgeBand}
      onSelectFocus={handleSelectFocus}
      onSelectTradition={handleSelectTradition}
      onSelectHand={handleSelectHand}
      onToggleInsight={handleToggleInsight}
      onContinue={handleFunnelAdvance}
      onSkip={handleFunnelAdvance}
      onBack={handleFunnelBackPress}
    />
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    ...type.bodyMd,
    color: colors.mute,
    textAlign: 'center',
  },
});
