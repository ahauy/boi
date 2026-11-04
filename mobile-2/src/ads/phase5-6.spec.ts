import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  canTriggerInterstitial,
  getInterstitialPolicyState,
  recordInterstitialShown,
  recordRewardedShown,
  resetInterstitialPolicyForTests,
  setInterstitialRoute,
  setInterstitialVipState,
  setSessionStartTimeForTests,
  setStartupStep3Done,
  setPaywallDeclineCount,
  SESSION_WARMUP_MS,
  FIRST_INTERSTITIAL_GAP_MS,
  SUBSEQUENT_INTERSTITIAL_GAP_MS,
  ADS_USER_GAP_MS,
  MAX_INTERSTITIALS_PER_SESSION,
  POST_REWARDED_COOLDOWN_MS,
} from './interstitial-policy';
import {
  runGatedTap,
  resetTapGateForTests,
  TAP_DEBOUNCE_MS,
} from '../ui/tap-gate';
import {
  watch,
  watchForAction,
  getRewardedCooldownRemainingMs,
  resetRewardedForTests,
  setLastAdRewardCompletedAtForTests,
} from './rewarded';
import {
  recordExternalActivity,
  finishExternalActivity,
  resetExternalActivity,
} from '../lib/external-activity';
import { adsStore, recordAdShown } from './ads-store';

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
const mockShowMaxRewarded = vi.fn();
const mockIsMaxRewardedReady = vi.fn();

vi.mock('./ads-service', () => ({
  showMaxRewarded: (placement?: string) => mockShowMaxRewarded(placement),
  isMaxRewardedReady: () => mockIsMaxRewardedReady(),
  isInterstitialReady: vi.fn(async () => true),
  preloadInterstitial: vi.fn(),
  showInterstitial: vi.fn(),
}));

// Mock earn-api
const mockCreateAdReward = vi.fn();
const mockClaimAdReward = vi.fn();
const mockReleaseAdReward = vi.fn();

vi.mock('../earn/earn-api', () => ({
  createAdReward: (kind: string, placement?: string) =>
    mockCreateAdReward(kind, placement),
  claimAdReward: (id: string) => mockClaimAdReward(id),
  releaseAdReward: (id: string) => mockReleaseAdReward(id),
}));

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
      setSessionStartTimeForTests(BASE_TIME);
      setStartupStep3Done(true);
      setInterstitialVipState({ vipKnown: true, isVip: false });
      setInterstitialRoute('/(tabs)/index');
    });

    it('VIP false: blocks VIP users and unknown VIP status', () => {
      const now = BASE_TIME + FIRST_INTERSTITIAL_GAP_MS + 1000;

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
      const now = BASE_TIME + FIRST_INTERSTITIAL_GAP_MS + 1000;

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

    it('Warmup <15s false: blocks interstitials during initial 15s session warmup', () => {
      // 10s elapsed (< 15s) -> blocked
      const warmupTime = BASE_TIME + 10_000;
      expect(canTriggerInterstitial('screen_change', { now: warmupTime })).toBe(
        false
      );
    });

    it('First interstitial >=45s: first interstitial must wait >= 45s from session start', () => {
      // 30s elapsed (> 15s warmup, but < 45s first gap) -> blocked
      const beforeFirstGap = BASE_TIME + 30_000;
      expect(
        canTriggerInterstitial('screen_change', { now: beforeFirstGap })
      ).toBe(false);

      // 46s elapsed (>= 45s first gap) -> allowed
      const atFirstGap = BASE_TIME + FIRST_INTERSTITIAL_GAP_MS + 1_000;
      expect(canTriggerInterstitial('screen_change', { now: atFirstGap })).toBe(
        true
      );
    });

    it('Subsequent >=90s: subsequent interstitials enforce 90s gap (or 30s for adsUser)', () => {
      const firstShownAt = BASE_TIME + FIRST_INTERSTITIAL_GAP_MS + 1_000;
      recordInterstitialShown(firstShownAt);

      // 40s later (< 90s gap) -> blocked
      expect(
        canTriggerInterstitial('screen_change', { now: firstShownAt + 40_000 })
      ).toBe(false);

      // 91s later (>= 90s gap) -> allowed
      expect(
        canTriggerInterstitial('screen_change', {
          now: firstShownAt + SUBSEQUENT_INTERSTITIAL_GAP_MS + 1_000,
        })
      ).toBe(true);

      // For Ads User (3 paywall declines), cooldown gap drops to 30s
      setPaywallDeclineCount(3);
      expect(getInterstitialPolicyState().isAdsUser).toBe(true);

      // 31s later (>= 30s gap for ads user) -> allowed
      expect(
        canTriggerInterstitial('screen_change', {
          now: firstShownAt + ADS_USER_GAP_MS + 1_000,
        })
      ).toBe(true);
    });

    it('Max 6/session: strictly caps interstitials at 6 per session', () => {
      let t = BASE_TIME + FIRST_INTERSTITIAL_GAP_MS + 1_000;

      for (let i = 0; i < MAX_INTERSTITIALS_PER_SESSION; i++) {
        expect(canTriggerInterstitial('screen_change', { now: t })).toBe(true);
        recordInterstitialShown(t);
        t += SUBSEQUENT_INTERSTITIAL_GAP_MS + 5_000;
      }

      // 7th interstitial -> blocked even with plenty of elapsed time
      expect(
        canTriggerInterstitial('screen_change', {
          now: t + SUBSEQUENT_INTERSTITIAL_GAP_MS * 10,
        })
      ).toBe(false);
    });

    it('20s post-rewarded cooldown: enforces 20s cooldown after rewarded ad completes', () => {
      const now = BASE_TIME + FIRST_INTERSTITIAL_GAP_MS + 5_000;

      // Rewarded ad shown at now
      recordRewardedShown(now);

      // 10s later (< 20s) -> blocked
      expect(
        canTriggerInterstitial('screen_change', { now: now + 10_000 })
      ).toBe(false);

      // 21s later (>= 20s) -> allowed
      expect(
        canTriggerInterstitial('screen_change', {
          now: now + POST_REWARDED_COOLDOWN_MS + 1_000,
        })
      ).toBe(true);
    });

    it('External activity suppression: suppresses interstitials while external activity active or in grace period', () => {
      const now = BASE_TIME + FIRST_INTERSTITIAL_GAP_MS + 5_000;

      expect(canTriggerInterstitial('screen_change', { now })).toBe(true);

      // External activity begins (e.g. ad display)
      recordExternalActivity('ad');
      expect(canTriggerInterstitial('screen_change', { now })).toBe(false);

      // External activity finishes (2s grace period begins)
      finishExternalActivity('ad');
      expect(canTriggerInterstitial('screen_change', { now })).toBe(false);
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
    it('Server nonce create -> claim on completion: completes full rewarded cycle', async () => {
      mockCreateAdReward.mockResolvedValueOnce({
        nonceId: 'nonce-abc-123',
        expiresAt: '2026-11-04T12:00:00Z',
      });
      mockShowMaxRewarded.mockResolvedValueOnce({
        rewarded: true,
        completed: true,
      });
      mockClaimAdReward.mockResolvedValueOnce({
        id: 'nonce-abc-123',
        amount: 5,
        balance: 25,
      });

      const result = await watch('currency_tab', 'ad_reward');

      expect(result.success).toBe(true);
      expect(mockCreateAdReward).toHaveBeenCalledWith('ad_reward', 'currency_tab');
      expect(mockShowMaxRewarded).toHaveBeenCalledWith('currency_tab');
      expect(mockClaimAdReward).toHaveBeenCalledWith('nonce-abc-123');
      expect(mockReleaseAdReward).not.toHaveBeenCalled();
    });

    it('Cancel on early close: deletes server nonce ticket when user closes early', async () => {
      mockCreateAdReward.mockResolvedValueOnce({
        nonceId: 'nonce-closed-early',
      });
      mockShowMaxRewarded.mockResolvedValueOnce({
        rewarded: false,
        completed: false,
      });
      mockReleaseAdReward.mockResolvedValueOnce({ status: 'released' });

      const result = await watch('currency_tab', 'ad_reward');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ad_closed_early');
      expect(mockClaimAdReward).not.toHaveBeenCalled();
      expect(mockReleaseAdReward).toHaveBeenCalledWith('nonce-closed-early');
    });

    it('Cancel on ad failure: deletes server nonce ticket when ad display throws', async () => {
      mockCreateAdReward.mockResolvedValueOnce({
        nonceId: 'nonce-failed-display',
      });
      mockShowMaxRewarded.mockRejectedValueOnce(new Error('Display failed'));
      mockReleaseAdReward.mockResolvedValueOnce({ status: 'released' });

      await expect(watch('currency_tab', 'ad_reward')).rejects.toThrow(
        'Display failed'
      );

      expect(mockClaimAdReward).not.toHaveBeenCalled();
      expect(mockReleaseAdReward).toHaveBeenCalledWith('nonce-failed-display');
    });

    it('10s cooldown: enforces 10-second client cooldown between ad_reward watches', async () => {
      const now = Date.now();
      setLastAdRewardCompletedAtForTests(now);

      // Remaining cooldown > 0
      expect(getRewardedCooldownRemainingMs(now + 2000)).toBe(8000);

      // Attempting to watch within cooldown throws error
      await expect(watch('currency_tab', 'ad_reward')).rejects.toThrow(
        /cooldown active/i
      );

      // After 10s cooldown expires -> can watch again
      setLastAdRewardCompletedAtForTests(now - 10_001);
      expect(getRewardedCooldownRemainingMs(now)).toBe(0);

      mockCreateAdReward.mockResolvedValueOnce({ nonceId: 'nonce-after-cd' });
      mockShowMaxRewarded.mockResolvedValueOnce({
        rewarded: true,
        completed: true,
      });
      mockClaimAdReward.mockResolvedValueOnce({ amount: 5, balance: 30 });

      const res = await watch('currency_tab', 'ad_reward');
      expect(res.success).toBe(true);
    });

    it('watchForAction: resolves completed state for action gates without currency nonce', async () => {
      mockShowMaxRewarded.mockResolvedValueOnce({
        rewarded: true,
        completed: true,
      });

      const res = await watchForAction('lucky_wheel');

      expect(res.completed).toBe(true);
      expect(mockShowMaxRewarded).toHaveBeenCalledWith('lucky_wheel');
      expect(mockCreateAdReward).not.toHaveBeenCalled();
    });
  });
});
