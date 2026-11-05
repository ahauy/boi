import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { deleteAccountErrorKey } from './delete-account';
import { SCREEN_LANGUAGES, SCREEN_STRINGS } from '../i18n/screen-strings';

const profileSource = readFileSync(path.resolve(__dirname, '../app/(tabs)/profile.tsx'), 'utf8');
const usersSource = readFileSync(path.resolve(__dirname, './users.ts'), 'utf8');

const KEYS = [
  'profile.deleteAccount',
  'profile.deleteAccountA11y',
  'profile.deleteAccountDeleting',
  'profile.deleteAccountStep1Title',
  'profile.deleteAccountStep1Body',
  'profile.deleteAccountContinue',
  'profile.deleteAccountStep2Title',
  'profile.deleteAccountStep2Body',
  'profile.deleteAccountConfirm',
  'profile.deleteAccountFailed',
  'profile.deleteAccountImageFailed',
];

describe('xoá tài khoản trong app', () => {
  it('ánh xạ mã lỗi sang lời rõ ràng, mã lạ rơi về lỗi chung', () => {
    expect(deleteAccountErrorKey({ code: 'IMAGE_DELETE_FAILED' })).toBe('profile.deleteAccountImageFailed');
    expect(deleteAccountErrorKey({ code: 'RATE_LIMITED' })).toBe('profile.deleteAccountFailed');
    expect(deleteAccountErrorKey(new Error('x'))).toBe('profile.deleteAccountFailed');
    expect(deleteAccountErrorKey(undefined)).toBe('profile.deleteAccountFailed');
  });

  it('đủ 9 ngôn ngữ cho mọi khoá, không để trống', () => {
    for (const key of KEYS) {
      const values = SCREEN_STRINGS[key];
      expect(values, key).toHaveLength(SCREEN_LANGUAGES.length);
      for (const v of values) expect(v.trim().length, key).toBeGreaterThan(0);
    }
  });

  it('lời xác nhận bước 1 nói rõ mất dữ liệu, nhắc GEM và huỷ VIP trên Google Play', () => {
    for (const body of SCREEN_STRINGS['profile.deleteAccountStep1Body']) {
      expect(body).toContain('{gems}');
      expect(body).toMatch(/Google Play/);
    }
  });

  it('gọi DELETE /me', () => {
    expect(usersSource).toMatch(/del<void>\('\/me'\)/);
  });

  it('Profile: hai bước xác nhận, không chen interstitial, xoá token cục bộ rồi về màn đầu', () => {
    const handler = profileSource.match(/function handleDeleteAccount\(\) \{[\s\S]*?\n  \}\n/)?.[0] ?? '';
    expect(handler).toContain('markNoInterstitialTap()');
    expect(handler).toContain('profile.deleteAccountStep1Title');
    expect(handler).toContain('profile.deleteAccountStep2Title');
    expect(handler.indexOf('Step1Title')).toBeLessThan(handler.indexOf('Step2Title'));
    // Chỉ nút ở bước 2 mới gọi xoá thật
    expect(handler.match(/performDeleteAccount\(\)/g)).toHaveLength(1);

    const perform = profileSource.match(/async function performDeleteAccount\(\) \{[\s\S]*?\n  \}\n/)?.[0] ?? '';
    expect(perform).toContain('markNoInterstitialTap()');
    expect(perform.indexOf('await deleteAccount()')).toBeLessThan(perform.indexOf('endLocalSession()'));
    expect(perform.indexOf('endLocalSession()')).toBeLessThan(perform.indexOf("router.replace('/')"));
    expect(perform).toContain('setDeleteAccountFailure(t(deleteAccountErrorKey(error)))');
  });

  it('nút xoá đặt noInterstitial', () => {
    const button = profileSource.match(/<Button[^>]*profile\.deleteAccount[\s\S]*?\/>/)?.[0] ?? '';
    expect(button).toContain('noInterstitial');
    expect(button).toContain('variant="danger"');
  });
});
