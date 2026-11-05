import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { blockedPermissionsFor, isReleaseProfile } = require('../../plugins/blocked-permissions') as {
  blockedPermissionsFor: (env: Record<string, string | undefined>, existing?: string[]) => string[];
  isReleaseProfile: (env: Record<string, string | undefined>) => boolean;
};

const SAW = 'android.permission.SYSTEM_ALERT_WINDOW';

describe('quyền Android bị chặn', () => {
  it('luôn chặn ghi âm và sinh trắc học, giữ quyền đã khai sẵn', () => {
    const blocked = blockedPermissionsFor({}, ['android.permission.RECORD_AUDIO']);
    expect(blocked).toEqual(
      expect.arrayContaining([
        'android.permission.RECORD_AUDIO',
        'android.permission.USE_BIOMETRIC',
        'android.permission.USE_FINGERPRINT',
      ]),
    );
    expect(new Set(blocked).size).toBe(blocked.length);
  });

  it('SYSTEM_ALERT_WINDOW chỉ bị chặn ở EAS profile preview và production', () => {
    expect(blockedPermissionsFor({ EAS_BUILD_PROFILE: 'production' })).toContain(SAW);
    expect(blockedPermissionsFor({ EAS_BUILD_PROFILE: 'preview' })).toContain(SAW);
    expect(blockedPermissionsFor({ EAS_BUILD_PROFILE: 'development' })).not.toContain(SAW);
    expect(blockedPermissionsFor({})).not.toContain(SAW);
    expect(isReleaseProfile({ EAS_BUILD_PROFILE: 'production' })).toBe(true);
    expect(isReleaseProfile({ NODE_ENV: 'production' })).toBe(false);
  });

  it('không chặn quyền mà SDK quảng cáo, billing, camera, mạng hay haptics cần', () => {
    const blocked = blockedPermissionsFor({ EAS_BUILD_PROFILE: 'production' });
    for (const needed of [
      'android.permission.CAMERA',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.WAKE_LOCK',
      'android.permission.VIBRATE',
      'android.permission.FOREGROUND_SERVICE',
      'com.google.android.gms.permission.AD_ID',
      'com.android.vending.BILLING',
    ]) {
      expect(blocked).not.toContain(needed);
    }
  });
});
