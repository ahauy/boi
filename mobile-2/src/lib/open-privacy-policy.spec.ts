import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openBrowserAsync = vi.fn();

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { currentState: 'active', addEventListener: vi.fn() },
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock('expo-web-browser', () => ({ openBrowserAsync: (...args: unknown[]) => openBrowserAsync(...args) }));

import { ADS_CONFIG } from '../ads/ads-config';
import { isExternalActivityActive, resetExternalActivity } from './external-activity';
import { openTerms } from './open-terms';
import { openPrivacyPolicy } from './open-privacy-policy';
import { SCREEN_LANGUAGES, SCREEN_STRINGS } from '../i18n/screen-strings';

const profileSource = readFileSync(path.resolve(__dirname, '../app/(tabs)/profile.tsx'), 'utf8');

describe('hàng Chính sách riêng tư ở màn Profile', () => {
  beforeEach(() => {
    openBrowserAsync.mockReset();
    resetExternalActivity();
  });

  it('có mặt trong màn Profile, gắn đủ khoá i18n và đánh dấu không chen interstitial', () => {
    expect(profileSource).toContain("t('profile.privacyPolicy')");
    expect(profileSource).toContain("t('profile.privacyPolicyA11y')");
    expect(profileSource).toContain("t('profile.privacyPolicyFailed')");
    const handler = profileSource.match(/async function handleOpenPrivacyPolicy\(\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(handler).toContain('markNoInterstitialTap()');
    expect(handler).toContain('openPrivacyPolicy()');
    expect(handler).toContain('setPrivacyPolicyFailed(true)');
  });

  it('URL luôn có (mặc định của ads-config) và trỏ tới /privacy', () => {
    expect(ADS_CONFIG.urls.privacy).toMatch(/^https?:\/\/.+\/privacy$/);
  });

  it('bấm mở đúng ADS_CONFIG.urls.privacy bằng trình duyệt qua external activity', async () => {
    let activeDuringOpen = false;
    openBrowserAsync.mockImplementation(async () => {
      activeDuringOpen = isExternalActivityActive(0);
      return { type: 'opened' };
    });

    await expect(openPrivacyPolicy()).resolves.toBe(true);

    expect(openBrowserAsync).toHaveBeenCalledTimes(1);
    expect(openBrowserAsync).toHaveBeenCalledWith(ADS_CONFIG.urls.privacy);
    expect(activeDuringOpen).toBe(true);
  });

  it('mở lỗi thì trả false (màn hiện thông báo lỗi) và không ném', async () => {
    openBrowserAsync.mockRejectedValue(new Error('no browser'));

    await expect(openPrivacyPolicy()).resolves.toBe(false);
    expect(isExternalActivityActive(0)).toBe(false);
  });

  it('chuỗi i18n có đủ 9 ngôn ngữ', () => {
    expect(SCREEN_LANGUAGES).toHaveLength(9);
    for (const key of ['profile.privacyPolicy', 'profile.privacyPolicyBody', 'profile.privacyPolicyA11y', 'profile.privacyPolicyFailed']) {
      const row = SCREEN_STRINGS[key as keyof typeof SCREEN_STRINGS] as readonly string[];
      expect(row).toHaveLength(9);
      row.forEach((text) => expect(text.trim()).not.toBe(''));
    }
  });
});

describe('hàng Điều khoản ở màn Profile', () => {
  beforeEach(() => {
    openBrowserAsync.mockReset();
    resetExternalActivity();
  });

  it('có mặt trong Profile, đủ khoá i18n 9 ngôn ngữ và đánh dấu không chen interstitial', () => {
    for (const key of ['profile.terms', 'profile.termsBody', 'profile.termsA11y', 'profile.termsFailed']) {
      expect(profileSource).toContain(key);
      expect(SCREEN_STRINGS[key]).toHaveLength(SCREEN_LANGUAGES.length);
    }
    const handler = profileSource.match(/async function handleOpenTerms\(\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(handler).toContain('markNoInterstitialTap()');
    expect(handler).toContain('openTerms()');
    expect(handler).toContain('setTermsFailed(true)');
  });

  it('mở đúng ADS_CONFIG.urls.terms, lỗi thì trả false', async () => {
    openBrowserAsync.mockResolvedValue({ type: 'opened' });
    await expect(openTerms()).resolves.toBe(true);
    expect(openBrowserAsync).toHaveBeenCalledWith(ADS_CONFIG.urls.terms);
    openBrowserAsync.mockRejectedValue(new Error('x'));
    await expect(openTerms()).resolves.toBe(false);
  });
});
