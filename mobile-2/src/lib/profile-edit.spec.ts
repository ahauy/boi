import { describe, expect, it } from 'vitest';
import { SCREEN_STRINGS } from '../i18n/screen-strings';
import {
  AVATAR_MAX_BYTES,
  avatarAssetProblem,
  avatarUploadName,
  DISPLAY_NAME_MAX,
  profileErrorKey,
  validateDisplayName,
} from './profile-edit';

describe('validateDisplayName', () => {
  it('cắt khoảng trắng và nhận tên hợp lệ', () => {
    expect(validateDisplayName('  An  ')).toEqual({ ok: true, value: 'An' });
  });
  it('từ chối tên rỗng hoặc chỉ khoảng trắng', () => {
    expect(validateDisplayName('')).toEqual({ ok: false, errorKey: 'editProfile.nameRequired' });
    expect(validateDisplayName('   ')).toEqual({ ok: false, errorKey: 'editProfile.nameRequired' });
  });
  it('giới hạn 50 ký tự sau khi trim', () => {
    expect(validateDisplayName('a'.repeat(DISPLAY_NAME_MAX)).ok).toBe(true);
    expect(validateDisplayName(` ${'a'.repeat(DISPLAY_NAME_MAX)} `).ok).toBe(true);
    expect(validateDisplayName('a'.repeat(DISPLAY_NAME_MAX + 1))).toEqual({ ok: false, errorKey: 'editProfile.nameTooLong' });
  });
});

describe('profileErrorKey', () => {
  it.each([
    ['AVATAR_TOO_LARGE', 'editProfile.err.tooLarge'],
    ['AVATAR_INVALID_TYPE', 'editProfile.err.invalidType'],
    ['AVATAR_UPLOAD_FAILED', 'editProfile.err.uploadFailed'],
    ['AVATAR_UNAVAILABLE', 'editProfile.err.unavailable'],
    ['AVATAR_UPDATE_FAILED', 'editProfile.err.updateFailed'],
    ['AVATAR_DELETE_FAILED', 'editProfile.err.updateFailed'],
    ['RATE_LIMITED', 'editProfile.err.rateLimited'],
    ['VALIDATION_ERROR', 'editProfile.err.validation'],
    ['NETWORK_ERROR', 'editProfile.err.network'],
    ['SOMETHING_ELSE', 'editProfile.err.generic'],
    [undefined, 'editProfile.err.generic'],
  ])('%s -> %s', (code, key) => {
    expect(profileErrorKey(code)).toBe(key);
  });

  it('mọi khoá trả về đều có chuỗi 9 ngôn ngữ', () => {
    for (const code of ['AVATAR_TOO_LARGE', 'AVATAR_INVALID_TYPE', 'AVATAR_UPLOAD_FAILED', 'AVATAR_UNAVAILABLE', 'RATE_LIMITED', 'VALIDATION_ERROR', 'NETWORK_ERROR', 'x']) {
      expect(SCREEN_STRINGS[profileErrorKey(code)]).toHaveLength(9);
    }
  });
});

describe('avatarAssetProblem', () => {
  it('chặn ảnh quá 5 MB và sai định dạng, cho qua ảnh hợp lệ', () => {
    expect(avatarAssetProblem({ fileSize: AVATAR_MAX_BYTES + 1, mimeType: 'image/jpeg' })).toBe('editProfile.err.tooLarge');
    expect(avatarAssetProblem({ fileSize: 1000, mimeType: 'image/gif' })).toBe('editProfile.err.invalidType');
    expect(avatarAssetProblem({ fileSize: AVATAR_MAX_BYTES, mimeType: 'image/WEBP' })).toBeNull();
    expect(avatarAssetProblem({})).toBeNull();
  });
});

describe('avatarUploadName', () => {
  it('chọn đuôi theo mime, mặc định jpeg', () => {
    expect(avatarUploadName('image/png')).toMatchObject({ type: 'image/png', name: expect.stringMatching(/\.png$/) });
    expect(avatarUploadName(undefined)).toMatchObject({ type: 'image/jpeg', name: expect.stringMatching(/\.jpg$/) });
  });
});
