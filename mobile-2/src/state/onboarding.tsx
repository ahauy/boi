import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { hasCompletedOnboarding, markOnboardingComplete } from '../lib/preferences';
import { fetchReadings } from '../lib/readings';
import { useAuth } from './auth';
import {
  loadOnboardingProfile,
  OnboardingAnswers,
  saveOnboardingProfile,
} from '../onboarding/onboarding-machine';

export type OnboardingStatus = 'loading' | 'pending' | 'done';

export interface OnboardingContextValue {
  status: OnboardingStatus;
  profile: OnboardingAnswers | null;
  /** Marks onboarding complete and saves optional profile answers locally on device (§4.2) */
  complete(answers?: OnboardingAnswers): Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus>('loading');
  const [profile, setProfile] = useState<OnboardingAnswers | null>(null);

  useEffect(() => {
    if (authStatus !== 'ready') return;
    let cancelled = false;

    void (async () => {
      const savedProfile = await loadOnboardingProfile();
      if (!cancelled && savedProfile) {
        setProfile(savedProfile);
      }

      if (await hasCompletedOnboarding()) {
        if (!cancelled) setStatus('done');
        return;
      }

      // Reinstall on iOS may keep Keychain session: if user already has readings, skip onboarding
      try {
        const page = await fetchReadings(undefined, 1);
        if (page.items.length > 0) {
          await markOnboardingComplete();
          if (!cancelled) setStatus('done');
          return;
        }
      } catch {
        // Offline or fresh user: proceed to onboarding
      }

      if (!cancelled) setStatus('pending');
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const complete = useCallback(async (answers?: OnboardingAnswers) => {
    if (answers) {
      await saveOnboardingProfile(answers);
      setProfile(answers);
    }
    await markOnboardingComplete();
    setStatus('done');
  }, []);

  const value = useMemo(
    () => ({ status, profile, complete }),
    [status, profile, complete]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
