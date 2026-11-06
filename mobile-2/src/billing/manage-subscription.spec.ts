import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).__DEV__ = false;

const mocks = vi.hoisted(() => ({
  appStateHandlers: [] as ((state: string) => void)[],
  removeListener: vi.fn(),
  openURL: vi.fn<(url: string) => Promise<void>>(),
}));

vi.mock('../lib/api', () => ({ post: vi.fn(), get: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs: any) => objs.android },
  AppState: {
    addEventListener: vi.fn((_event: string, handler: (state: string) => void) => {
      mocks.appStateHandlers.push(handler);
      return { remove: mocks.removeListener };
    }),
  },
  Linking: { openURL: mocks.openURL },
  BackHandler: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(), removeItem: vi.fn() },
}));

import { isMediationDebuggerEnabled } from '../ads/ads-service';
import {
  isExternalActivityActive,
  resetExternalActivity,
} from '../lib/external-activity';
import { SCREEN_LANGUAGES, SCREEN_STRINGS } from '../i18n/screen-strings';
import {
  openSubscriptionManagement,
  PLAY_SUBSCRIPTIONS_URL,
  resetBillingServiceForTesting,
  setBillingSdkForTesting,
} from './index';

const emitAppState = (state: string) => {
  for (const handler of [...mocks.appStateHandlers]) handler(state);
};

describe('openSubscriptionManagement (Profile "Quản lý gói VIP")', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appStateHandlers.length = 0;
    mocks.openURL.mockResolvedValue(undefined);
    resetExternalActivity();
    resetBillingServiceForTesting();
  });

  it('opens the Play subscription page for the VIP product through the SDK', async () => {
    const deepLinkToSubscriptions = vi.fn().mockResolvedValue(undefined);
    setBillingSdkForTesting({ deepLinkToSubscriptions } as any);

    await expect(openSubscriptionManagement('weeklyid')).resolves.toEqual({ ok: true, via: 'play' });

    expect(deepLinkToSubscriptions).toHaveBeenCalledWith({
      skuAndroid: 'weeklyid',
      packageNameAndroid: 'com.palmsight.mobile2',
    });
    expect(mocks.openURL).not.toHaveBeenCalled();
  });

  it('omits the sku when the product is unknown', async () => {
    const deepLinkToSubscriptions = vi.fn().mockResolvedValue(undefined);
    setBillingSdkForTesting({ deepLinkToSubscriptions } as any);

    await openSubscriptionManagement(null);

    expect(deepLinkToSubscriptions).toHaveBeenCalledWith({
      skuAndroid: undefined,
      packageNameAndroid: 'com.palmsight.mobile2',
    });
  });

  it('falls back to the Play web URL when the SDK call fails', async () => {
    const deepLinkToSubscriptions = vi.fn().mockRejectedValue(new Error('no play store'));
    setBillingSdkForTesting({ deepLinkToSubscriptions } as any);

    await expect(openSubscriptionManagement('weeklyid')).resolves.toEqual({ ok: true, via: 'web' });

    expect(mocks.openURL).toHaveBeenCalledWith(PLAY_SUBSCRIPTIONS_URL);
    expect(PLAY_SUBSCRIPTIONS_URL).toBe('https://play.google.com/store/account/subscriptions');
  });

  it('falls back to the web URL when the SDK is not available', async () => {
    setBillingSdkForTesting(null);

    const result = await openSubscriptionManagement('weeklyid');

    expect(result.ok).toBe(true);
    expect(mocks.openURL).toHaveBeenCalledWith(PLAY_SUBSCRIPTIONS_URL);
  });

  it('reports failure, and does not leave the app marked as away, when nothing can be opened', async () => {
    setBillingSdkForTesting({
      deepLinkToSubscriptions: vi.fn().mockRejectedValue(new Error('sdk')),
    } as any);
    mocks.openURL.mockRejectedValue(new Error('no handler'));

    await expect(openSubscriptionManagement('weeklyid')).resolves.toEqual({ ok: false });

    expect(isExternalActivityActive(0)).toBe(false);
  });

  it('keeps the external activity until the user returns from Google Play (§6.3)', async () => {
    setBillingSdkForTesting({ deepLinkToSubscriptions: vi.fn().mockResolvedValue(undefined) } as any);

    await openSubscriptionManagement('weeklyid');
    expect(isExternalActivityActive(0)).toBe(true);

    emitAppState('background');
    expect(isExternalActivityActive(0)).toBe(true);

    emitAppState('active');
    expect(isExternalActivityActive(0)).toBe(false);
    expect(mocks.removeListener).toHaveBeenCalled();
  });
});

describe('Profile copy and debug-only rows', () => {
  it('ad privacy copy has no SDK jargon in any language and every new key has 9 languages', () => {
    for (const key of [
      'profile.adPrivacyBody',
      'profile.adPrivacyFailed',
      'profile.manageVipFailed',
      'profile.vipUpgradeYearly',
      'paywall.previewNotice',
      'paywall.unavailableNotice',
    ]) {
      expect(SCREEN_STRINGS[key], key).toHaveLength(SCREEN_LANGUAGES.length);
    }
    for (const text of SCREEN_STRINGS['profile.adPrivacyBody']) {
      expect(text).not.toMatch(/UMP|MAX|SDK/);
    }
  });

  it('Mediation Debugger is only enabled in development builds (§5.6)', () => {
    expect(isMediationDebuggerEnabled()).toBe(false);
    (globalThis as any).__DEV__ = true;
    try {
      expect(isMediationDebuggerEnabled()).toBe(true);
    } finally {
      (globalThis as any).__DEV__ = false;
    }
  });
});
