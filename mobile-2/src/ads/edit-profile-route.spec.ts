import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: { currentState: 'active', addEventListener: vi.fn() } }));

import { isInterstitialRouteExcluded } from './interstitial-policy';

describe('route sửa hồ sơ', () => {
  it('nằm trong danh sách loại trừ interstitial (screen_change khi vào/ra bộ chọn ảnh không chen quảng cáo)', () => {
    expect(isInterstitialRouteExcluded('/edit-profile')).toBe(true);
    expect(isInterstitialRouteExcluded('/profile')).toBe(false);
  });
});
