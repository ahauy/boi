import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hasCompletedOnboarding, markOnboardingComplete } from '../lib/preferences';
import { fetchReadings } from '../lib/readings';
import { useAuth } from './auth';

export type OnboardingStatus = 'loading' | 'pending' | 'done';

interface OnboardingContextValue {
  status: OnboardingStatus;
  /** Gọi khi người dùng đã đi hết slide cuối */
  complete(): Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus>('loading');

  useEffect(() => {
    if (authStatus !== 'ready') return;
    let cancelled = false;

    void (async () => {
      if (await hasCompletedOnboarding()) {
        if (!cancelled) setStatus('done');
        return;
      }

      // Cài lại app trên iOS có thể giữ Keychain cũ: đã có bài bói thì không bắt xem lại onboarding
      try {
        const page = await fetchReadings();
        if (page.items.length > 0) {
          await markOnboardingComplete();
          if (!cancelled) setStatus('done');
          return;
        }
      } catch {
        // Mất mạng: cứ cho onboarding hiện, không chặn người dùng mới
      }

      if (!cancelled) setStatus('pending');
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const complete = useCallback(async () => {
    await markOnboardingComplete();
    setStatus('done');
  }, []);

  const value = useMemo(() => ({ status, complete }), [status, complete]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding phải nằm trong OnboardingProvider');
  return context;
}
