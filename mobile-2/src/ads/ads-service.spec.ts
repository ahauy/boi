import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeAds,
  LATE_REWARD_WAIT_MS,
  REWARDED_DISPLAY_TIMEOUT_MS,
  resetAdsServiceForTesting,
  setMaxSdkForTesting,
  showRewardedAd,
  type MaxSdk,
} from './ads-service';
import { ADS_CONFIG } from './ads-config';
import { adsStore } from './ads-store';
import { resetAdEvents } from './ad-events';
import { resetExternalActivity } from '../lib/external-activity';
import { checkDeviceIntegrity } from '../lib/integrity-gate';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));

vi.mock('../lib/integrity-gate', () => ({
  checkDeviceIntegrity: vi.fn(() => ({ blocked: false })),
}));

type Handler = (info: any) => void;

function fakeFullscreenAd() {
  const handlers: Record<string, Handler> = {};
  const listener = (name: string) => (handler: Handler) => {
    handlers[name] = handler;
  };
  return {
    handlers,
    isAdReady: vi.fn(async () => true),
    loadAd: vi.fn(),
    showAd: vi.fn(),
    addAdLoadedEventListener: listener('loaded'),
    addAdLoadFailedEventListener: listener('loadFailed'),
    addAdDisplayedEventListener: listener('displayed'),
    addAdFailedToDisplayEventListener: listener('displayFailed'),
    addAdHiddenEventListener: listener('hidden'),
    addAdClickedEventListener: listener('clicked'),
    addAdRevenuePaidListener: listener('revenue'),
    addAdReceivedRewardEventListener: listener('reward'),
  };
}

function fakeSdk(geography = 'O') {
  const rewarded = fakeFullscreenAd();
  const interstitial = fakeFullscreenAd();
  const appLovin = {
    initialize: vi.fn(async () => ({ consentFlowUserGeography: geography })),
    setTermsAndPrivacyPolicyFlowEnabled: vi.fn(),
    setPrivacyPolicyUrl: vi.fn(),
    setTermsOfServiceUrl: vi.fn(),
    setTestDeviceAdvertisingIds: vi.fn(),
  };
  const sdk = {
    default: appLovin,
    ConsentFlowUserGeography: { GDPR: 'G', OTHER: 'O', UNKNOWN: 'U' },
    RewardedAd: rewarded,
    InterstitialAd: interstitial,
    addNativeUIComponentAdViewAdLoadedEventListener: vi.fn(),
    addNativeUIComponentAdViewAdLoadFailedEventListener: vi.fn(),
  };
  setMaxSdkForTesting(sdk as unknown as MaxSdk);
  return { appLovin, rewarded, interstitial };
}

describe('ads-service against the MAX SDK surface', () => {
  const unit = ADS_CONFIG.units.rewarded;
  const info = { adUnitId: unit, networkName: 'AppLovin' };

  beforeEach(() => {
    vi.useFakeTimers();
    resetAdEvents();
    resetExternalActivity();
    adsStore.reset();
    resetAdsServiceForTesting();
    vi.mocked(checkDeviceIntegrity).mockReturnValue({ blocked: false } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    setMaxSdkForTesting(null);
  });

  describe('initializeAds', () => {
    it('awaits the promise form of initialize and maps the consent geography', async () => {
      const { appLovin } = fakeSdk('G');

      await expect(initializeAds()).resolves.toBe('GDPR');

      expect(appLovin.initialize).toHaveBeenCalledWith('test-sdk-key');
      expect(adsStore.getState().status).toBe('ready');
      expect(adsStore.getState().consentRegion).toBe('GDPR');
    });

    it('shares one run between concurrent callers', async () => {
      const { appLovin } = fakeSdk();

      await Promise.all([initializeAds(), initializeAds()]);

      expect(appLovin.initialize).toHaveBeenCalledTimes(1);
    });

    it('never initializes on a blocked device', async () => {
      const { appLovin } = fakeSdk();
      vi.mocked(checkDeviceIntegrity).mockReturnValue({ blocked: true } as any);

      await expect(initializeAds()).resolves.toBe('UNKNOWN');

      expect(appLovin.initialize).not.toHaveBeenCalled();
    });

    it('retries on a later call after a failed init', async () => {
      const { appLovin } = fakeSdk();
      appLovin.initialize.mockRejectedValueOnce(new Error('network'));

      await expect(initializeAds()).resolves.toBe('UNKNOWN');
      expect(adsStore.getState().status).toBe('failed');

      await expect(initializeAds()).resolves.toBe('OTHER');
      expect(adsStore.getState().status).toBe('ready');
    });
  });

  describe('showRewardedAd', () => {
    async function startedAd() {
      const sdk = fakeSdk();
      await initializeAds();
      const onReward = vi.fn();
      const result = showRewardedAd({ placement: 'p', customData: 'ticket', onReward });
      return { ...sdk, onReward, result };
    }

    it('passes placement and ticket to the SDK', async () => {
      const { rewarded, result } = await startedAd();

      expect(rewarded.showAd).toHaveBeenCalledWith(unit, 'p', 'ticket');

      rewarded.handlers.displayFailed(info);
      await expect(result).resolves.toBe('failed');
    });

    it('fires onReward in the reward callback and resolves when the ad closes', async () => {
      const { rewarded, onReward, result } = await startedAd();

      rewarded.handlers.displayed(info);
      rewarded.handlers.reward(info);
      expect(onReward).toHaveBeenCalledTimes(1);

      rewarded.handlers.hidden(info);
      await expect(result).resolves.toBe('rewarded');
    });

    it('fails when the ad is not displayed within 5 s', async () => {
      const { result } = await startedAd();

      await vi.advanceTimersByTimeAsync(REWARDED_DISPLAY_TIMEOUT_MS);

      await expect(result).resolves.toBe('failed');
      expect(adsStore.getState().fullScreenAdShowing).toBe(false);
    });

    it('waits 1.5 s for a late reward after an early close', async () => {
      const { rewarded, onReward, result } = await startedAd();

      rewarded.handlers.displayed(info);
      rewarded.handlers.hidden(info);
      await vi.advanceTimersByTimeAsync(LATE_REWARD_WAIT_MS - 100);
      rewarded.handlers.reward(info);

      await expect(result).resolves.toBe('rewarded');
      expect(onReward).toHaveBeenCalledTimes(1);
    });

    it('resolves closed when no reward arrives in that window', async () => {
      const { rewarded, onReward, result } = await startedAd();

      rewarded.handlers.displayed(info);
      rewarded.handlers.hidden(info);
      await vi.advanceTimersByTimeAsync(LATE_REWARD_WAIT_MS);

      await expect(result).resolves.toBe('closed');
      expect(onReward).not.toHaveBeenCalled();
    });

    it('does not reward without an SDK or a dev simulator', async () => {
      setMaxSdkForTesting(null);
      const onReward = vi.fn();

      await expect(showRewardedAd({ placement: 'p', onReward })).resolves.toBe('failed');

      expect(onReward).not.toHaveBeenCalled();
    });
  });
});
