import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { ADS_CONFIG } from './ads-config';
import { dispatchAdEvent } from './ad-events';
import {
  DISPLAY_TIMEOUT_MS,
  isInterstitialShowingSync,
  maybeShowThen,
  resetInterstitialManagerForTests,
  setInterstitialLoadedForTests,
} from './interstitial';
import {
  canTriggerInterstitial,
  getInterstitialPolicyState,
  recordInterstitialShown,
  resetInterstitialPolicyForTests,
  setInterstitialRoute,
  setInterstitialVipState,
  setStartupStep3Done,
  setPaywallDeclineCount,
  ADS_USER_GAP_MS,
  INTERSTITIAL_GAP_MS,
} from './interstitial-policy';
import {
  runGatedTap,
  resetTapGateForTests,
  TAP_DEBOUNCE_MS,
} from '../ui/tap-gate';
import {
  watch,
  watchForAction,
  resetRewardedForTests,
  setRewardedBalanceListener,
} from './rewarded';
import {
  recordExternalActivity,
  finishExternalActivity,
  resetExternalActivity,
} from '../lib/external-activity';
import { adsStore } from './ads-store';
import { AdRewardKind, AdRewardStatus } from '@palmsight/shared';
import { ApiError } from '../lib/api';

// Mock react-native
vi.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs: any) => objs.android },
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    currentState: 'active',
  },
  Keyboard: {
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  StyleSheet: {
    create: (s: any) => s,
    hairlineWidth: 1,
    absoluteFill: {},
  },
  View: 'View',
  Text: 'Text',
}));

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, val: string) => {
        store.set(key, val);
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});

// Mock ads-service
const mockEnsureRewardedReady = vi.fn();
const mockShowRewardedAd = vi.fn();

vi.mock('./ads-service', () => ({
  ensureRewardedReady: () => mockEnsureRewardedReady(),
  showRewardedAd: (options: unknown) => mockShowRewardedAd(options),
  preloadInterstitial: vi.fn(),
  showInterstitial: vi.fn(),
}));

// Mock earn-api
const mockCreateAdReward = vi.fn();
const mockClaimAdReward = vi.fn();
const mockReleaseAdReward = vi.fn();

vi.mock('../earn/earn-api', () => ({
  createAdReward: (kind: string) => mockCreateAdReward(kind),
  claimAdReward: (id: string) => mockClaimAdReward(id),
  releaseAdReward: (id: string) => mockReleaseAdReward(id),
}));

vi.mock('../lib/api', async () => {
  class MockApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
      readonly fields: Record<string, string> = {},
      readonly details: Record<string, unknown> = {}
    ) {
      super(message);
    }
  }
  return { ApiError: MockApiError };
});

const rewardThen = (result: string) =>
  mockShowRewardedAd.mockImplementationOnce(async (options: { onReward?: () => void }) => {
    options.onReward?.();
    return result;
  });

describe('Phase 5 & 6: Interstitial, Tap Gate & Rewarded Ads Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetExternalActivity();
    adsStore.reset();
    resetInterstitialPolicyForTests();
    resetTapGateForTests();
    resetRewardedForTests();
  });

  describe('1. Interstitial Policy (interstitial-policy.ts)', () => {
    const BASE_TIME = 100_000;

    beforeEach(() => {
      setStartupStep3Done(true);
      setInterstitialVipState({ vipKnown: true, isVip: false });
      setInterstitialRoute('/(tabs)/index');
    });

    it('VIP false: blocks VIP users and unknown VIP status', () => {
      const now = BASE_TIME;

      // Non-VIP with known status -> can trigger
      expect(canTriggerInterstitial('screen_change', { now })).toBe(true);

      // VIP user -> blocked
      setInterstitialVipState({ vipKnown: true, isVip: true });
      expect(canTriggerInterstitial('screen_change', { now })).toBe(false);

      // Unknown VIP status -> blocked
      setInterstitialVipState({ vipKnown: false, isVip: false });
      expect(canTriggerInterstitial('screen_change', { now })).toBe(false);
    });

    it('Onboarding false: blocks when target or current route is onboarding or intro', () => {
      const now = BASE_TIME;

      // Onboarding route -> blocked
      setInterstitialRoute('/onboarding');
      expect(canTriggerInterstitial('screen_change', { now })).toBe(false);

      // Target route is onboarding -> blocked
      setInterstitialRoute('/(tabs)/index');
      expect(
        canTriggerInterstitial('screen_change', {
          now,
          targetRoute: '/onboarding/funnel-2',
        })
      ).toBe(false);

      // Intro route -> blocked
      expect(
        canTriggerInterstitial('screen_change', {
          now,
          targetRoute: '/intro',
        })
      ).toBe(false);
    });

    it('Gap: interstitials are 90 s apart, or 60 s for ads users, with no session cap', () => {
      const firstShownAt = BASE_TIME;
      expect(canTriggerInterstitial('screen_change', { now: firstShownAt })).toBe(true);
      recordInterstitialShown(firstShownAt);

      expect(
        canTriggerInterstitial('screen_change', { now: firstShownAt + 40_000 })
      ).toBe(false);
      expect(
        canTriggerInterstitial('screen_change', {
          now: firstShownAt + INTERSTITIAL_GAP_MS + 1_000,
        })
      ).toBe(true);

      setPaywallDeclineCount(3);
      expect(getInterstitialPolicyState().isAdsUser).toBe(true);
      expect(
        canTriggerInterstitial('screen_change', {
          now: firstShownAt + ADS_USER_GAP_MS + 1_000,
        })
      ).toBe(true);
    });

    it('No session cap: a tenth interstitial is still allowed once the gap has passed', () => {
      let now = BASE_TIME;
      for (let shown = 0; shown < 10; shown++) {
        expect(canTriggerInterstitial('screen_change', { now })).toBe(true);
        recordInterstitialShown(now);
        now += INTERSTITIAL_GAP_MS + 1_000;
      }
    });

    it('External activity suppression: suppresses interstitials while external activity active or in grace period', () => {
      const now = Date.now();

      expect(canTriggerInterstitial('screen_change', { now })).toBe(true);

      // External activity begins (e.g. ad display)
      recordExternalActivity('ad');
      expect(canTriggerInterstitial('screen_change', { now })).toBe(false);

      // External activity finishes (2s grace period begins)
      finishExternalActivity('ad');
      expect(canTriggerInterstitial('screen_change', { now })).toBe(false);
    });
  });

  describe('1b. Interstitial manager (interstitial.ts)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      resetInterstitialManagerForTests();
      setStartupStep3Done(true);
      setInterstitialVipState({ vipKnown: true, isVip: false });
      setInterstitialRoute('/(tabs)/index');
      setInterstitialLoadedForTests(true);
    });

    afterEach(() => {
      resetInterstitialManagerForTests();
      vi.useRealTimers();
    });

    it('runs next and frees the flow when the ad never reports displayed', () => {
      const next = vi.fn();

      expect(maybeShowThen('after_core_action', next)).toBe(true);
      expect(next).not.toHaveBeenCalled();

      vi.advanceTimersByTime(DISPLAY_TIMEOUT_MS);

      expect(next).toHaveBeenCalledTimes(1);
      expect(isInterstitialShowingSync()).toBe(false);
      expect(adsStore.getState().fullScreenAdShowing).toBe(false);
    });

    it('counts the gap from the close, so a long ad does not eat it', () => {
      setPaywallDeclineCount(3);
      maybeShowThen('screen_change', vi.fn());
      dispatchAdEvent('interstitial', ADS_CONFIG.units.interstitial, 'displayed');

      vi.advanceTimersByTime(20_000);
      dispatchAdEvent('interstitial', ADS_CONFIG.units.interstitial, 'hidden');

      vi.advanceTimersByTime(15_000);
      expect(canTriggerInterstitial('screen_change')).toBe(false);

      vi.advanceTimersByTime(ADS_USER_GAP_MS - 15_000);
      expect(canTriggerInterstitial('screen_change')).toBe(true);
    });

    it('keeps the gap free when the ad never opened', () => {
      maybeShowThen('screen_change', vi.fn());

      vi.advanceTimersByTime(DISPLAY_TIMEOUT_MS);

      expect(getInterstitialPolicyState().lastInterstitialShownAt).toBe(0);
      expect(canTriggerInterstitial('screen_change')).toBe(true);
    });

    it('keeps the gap free when the ad fails to display', () => {
      maybeShowThen('screen_change', vi.fn());

      dispatchAdEvent('interstitial', ADS_CONFIG.units.interstitial, 'display_failed');

      expect(getInterstitialPolicyState().lastInterstitialShownAt).toBe(0);
    });

    it('keeps waiting for the close once the ad is displayed', () => {
      const next = vi.fn();
      maybeShowThen('after_core_action', next);

      dispatchAdEvent('interstitial', ADS_CONFIG.units.interstitial, 'displayed');
      vi.advanceTimersByTime(DISPLAY_TIMEOUT_MS * 2);
      expect(next).not.toHaveBeenCalled();

      dispatchAdEvent('interstitial', ADS_CONFIG.units.interstitial, 'hidden');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Tap Gate (tap-gate.ts)', () => {
    it('350ms debounce: ignores quick consecutive taps within 350ms', () => {
      const action = vi.fn();

      // First tap at t = 1000 -> runs
      const res1 = runGatedTap(action, { now: 1000, eligibleForAd: false });
      expect(res1).toBe(true);
      expect(action).toHaveBeenCalledTimes(1);

      // Second tap at t = 1200 (200ms < 350ms) -> debounced/ignored
      const res2 = runGatedTap(action, { now: 1200, eligibleForAd: false });
      expect(res2).toBe(false);
      expect(action).toHaveBeenCalledTimes(1);

      // Third tap at t = 1400 (400ms > 350ms) -> runs
      const res3 = runGatedTap(action, { now: 1400, eligibleForAd: false });
      expect(res3).toBe(true);
      expect(action).toHaveBeenCalledTimes(2);
    });

    it('Re-entrancy mutex: drops taps while an async action is in flight until resolved', async () => {
      let resolveAsyncAction: () => void = () => {};
      const pendingPromise = new Promise<void>((resolve) => {
        resolveAsyncAction = resolve;
      });

      const asyncAction = vi.fn(() => pendingPromise);
      const secondAction = vi.fn();

      // Start async action at t = 1000 -> locks mutex
      const res1 = runGatedTap(asyncAction, {
        now: 1000,
        eligibleForAd: false,
      });
      expect(res1).toBe(true);
      expect(asyncAction).toHaveBeenCalledTimes(1);

      // Second tap at t = 2000 (well past 350ms debounce, but mutex locked) -> dropped
      const res2 = runGatedTap(secondAction, {
        now: 2000,
        eligibleForAd: false,
      });
      expect(res2).toBe(false);
      expect(secondAction).not.toHaveBeenCalled();

      // Resolve async action
      resolveAsyncAction();
      await pendingPromise;

      // Third tap at t = 3000 -> mutex unlocked, runs successfully
      const res3 = runGatedTap(secondAction, {
        now: 3000,
        eligibleForAd: false,
      });
      expect(res3).toBe(true);
      expect(secondAction).toHaveBeenCalledTimes(1);
    });

    it('eligibleForAd: false and noInterstitial: true bypass interstitial checks', () => {
      // Set up ads user who would normally trigger ad
      setPaywallDeclineCount(3);
      expect(getInterstitialPolicyState().isAdsUser).toBe(true);

      const action = vi.fn();

      // Bypass with eligibleForAd: false
      runGatedTap(action, { now: 1000, eligibleForAd: false });
      expect(action).toHaveBeenCalledTimes(1);

      // Bypass with noInterstitial: true
      runGatedTap(action, { now: 2000, noInterstitial: true });
      expect(action).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. Rewarded Ads (rewarded.ts)', () => {
    const claimed = (status: AdRewardStatus, amount = 3, balance = 25) => ({
      id: 'ticket-1',
      kind: AdRewardKind.BONUS,
      status,
      amount,
      prizeIndex: null,
      balance,
      rewardDay: '2026-11-04',
    });

    beforeEach(() => {
      mockEnsureRewardedReady.mockResolvedValue(true);
      mockCreateAdReward.mockResolvedValue({ id: 'ticket-1' });
      mockReleaseAdReward.mockResolvedValue({ status: 'released' });
    });

    it('checks for an ad before creating a ticket', async () => {
      mockEnsureRewardedReady.mockResolvedValue(false);

      const result = await watch('not_enough_sheet', AdRewardKind.BONUS);

      expect(result.status).toBe('no_ad');
      expect(mockCreateAdReward).not.toHaveBeenCalled();
      expect(mockShowRewardedAd).not.toHaveBeenCalled();
    });

    it('shows no ad when the server refuses the ticket', async () => {
      mockCreateAdReward.mockRejectedValue(new ApiError(429, 'ad_limit_reached', 'Limit'));

      const result = await watch('not_enough_sheet', AdRewardKind.BONUS);

      expect(result).toMatchObject({ status: 'refused', errorCode: 'ad_limit_reached' });
      expect(mockShowRewardedAd).not.toHaveBeenCalled();
    });

    it('passes the ticket to the ad and claims inside the reward callback, before the ad closes', async () => {
      const order: string[] = [];
      mockClaimAdReward.mockImplementation(async () => {
        order.push('claim');
        return claimed(AdRewardStatus.REWARDED);
      });
      mockShowRewardedAd.mockImplementationOnce(async (options) => {
        options.onReward();
        order.push('ad closed');
        return 'rewarded';
      });
      const balances: number[] = [];
      setRewardedBalanceListener((balance) => balances.push(balance));

      const result = await watch('not_enough_sheet', AdRewardKind.BONUS);

      expect(result.status).toBe('rewarded');
      expect(mockShowRewardedAd.mock.calls[0][0]).toMatchObject({
        placement: 'not_enough_sheet',
        customData: 'ticket-1',
      });
      expect(order).toEqual(['claim', 'ad closed']);
      expect(balances).toEqual([25]);
      expect(mockReleaseAdReward).not.toHaveBeenCalled();
    });

    it('retries ad_not_finished once after retryAfter', async () => {
      mockClaimAdReward
        .mockRejectedValueOnce(new ApiError(409, 'ad_not_finished', 'Wait', {}, { retryAfter: 0 }))
        .mockResolvedValueOnce(claimed(AdRewardStatus.REWARDED));
      rewardThen('rewarded');

      const result = await watch('not_enough_sheet', AdRewardKind.BONUS);

      expect(result.status).toBe('rewarded');
      expect(mockClaimAdReward).toHaveBeenCalledTimes(2);
    });

    it('reports capped when the server caps the claim', async () => {
      mockClaimAdReward.mockResolvedValue(claimed(AdRewardStatus.CAPPED, 0));
      rewardThen('rewarded');

      const result = await watch('not_enough_sheet', AdRewardKind.BONUS);

      expect(result.status).toBe('capped');
    });

    it('releases the ticket when the ad closes early, and reports no ad when it fails', async () => {
      mockShowRewardedAd.mockResolvedValueOnce('closed');
      expect((await watch('placement', AdRewardKind.BONUS)).status).toBe('closed');

      mockShowRewardedAd.mockResolvedValueOnce('failed');
      expect((await watch('placement', AdRewardKind.BONUS)).status).toBe('no_ad');

      expect(mockReleaseAdReward).toHaveBeenCalledTimes(2);
      expect(mockClaimAdReward).not.toHaveBeenCalled();
    });

    it('allows one rewarded at a time', async () => {
      let finishAd: (result: string) => void = () => undefined;
      mockShowRewardedAd.mockImplementationOnce(
        () => new Promise((resolve) => (finishAd = resolve))
      );

      const first = watch('a', AdRewardKind.BONUS);
      await vi.waitFor(() => expect(mockShowRewardedAd).toHaveBeenCalled());

      expect((await watch('b', AdRewardKind.BONUS)).status).toBe('no_ad');
      expect(await watchForAction('save_share')).toBe('no_ad');

      finishAd('closed');
      await first;
    });

    it('watchForAction: uses no ticket, and skips the ad when the screen has gone', async () => {
      mockShowRewardedAd.mockResolvedValueOnce('rewarded');
      expect(await watchForAction('save_share')).toBe('completed');
      expect(mockCreateAdReward).not.toHaveBeenCalled();

      mockShowRewardedAd.mockClear();
      expect(await watchForAction('save_share', () => false)).toBe('unmounted');
      expect(mockShowRewardedAd).not.toHaveBeenCalled();
    });
  });
});
