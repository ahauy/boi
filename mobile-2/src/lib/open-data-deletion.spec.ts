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
import { openDataDeletion } from './open-data-deletion';

const profileSource = readFileSync(path.resolve(__dirname, '../app/(tabs)/profile.tsx'), 'utf8');

describe('mục Xoá dữ liệu ở màn Profile (A8)', () => {
  beforeEach(() => {
    openBrowserAsync.mockReset();
    resetExternalActivity();
  });

  it('có mặt trong màn Profile, gắn đủ khoá i18n và đánh dấu không chen interstitial', () => {
    expect(profileSource).toContain("t('profile.dataDeletionBody')");
    expect(profileSource).toContain("t('profile.dataDeletionLink')");
    expect(profileSource).toContain("t('profile.dataDeletionFailed')");
    const handler = profileSource.match(/async function handleOpenDataDeletion\(\) \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(handler).toContain('markNoInterstitialTap()');
    expect(handler).toContain('openDataDeletion()');
    expect(handler).toContain('setDataDeletionFailed(true)');
  });

  it('URL luôn có trong ADS_CONFIG.urls.dataDeletion và trỏ tới /data-deletion', () => {
    expect(ADS_CONFIG.urls.dataDeletion).toMatch(/^https?:\/\/.+\/data-deletion$/);
  });

  it('mở đúng ADS_CONFIG.urls.dataDeletion bằng trình duyệt qua external activity', async () => {
    let activeDuringOpen = false;
    openBrowserAsync.mockImplementation(async () => {
      activeDuringOpen = isExternalActivityActive(0);
      return { type: 'opened' };
    });

    await expect(openDataDeletion()).resolves.toBe(true);

    expect(openBrowserAsync).toHaveBeenCalledTimes(1);
    expect(openBrowserAsync).toHaveBeenCalledWith(ADS_CONFIG.urls.dataDeletion);
    expect(activeDuringOpen).toBe(true);
  });

  it('mở lỗi thì trả false (màn hiện thông báo lỗi) và không ném', async () => {
    openBrowserAsync.mockRejectedValue(new Error('no browser'));

    await expect(openDataDeletion()).resolves.toBe(false);
    expect(isExternalActivityActive(0)).toBe(false);
  });
});
