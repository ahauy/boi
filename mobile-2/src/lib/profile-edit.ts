/**
 * Logic thuần của màn sửa hồ sơ (không import react-native để test được bằng vitest).
 * Khoá i18n nằm trong screen-strings.ts; không bao giờ hiển thị message tiếng Việt của server.
 */

export const DISPLAY_NAME_MAX = 50;
/** Hợp đồng backend: ảnh đại diện tối đa 5 MB, chỉ jpeg/png/webp. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type DisplayNameCheck =
  | { ok: true; value: string }
  | { ok: false; errorKey: 'editProfile.nameRequired' | 'editProfile.nameTooLong' };

/** Cắt khoảng trắng hai đầu, 1–50 ký tự. Dùng khi chưa có updateProfileSchema trong shared. */
export function validateDisplayName(raw: string): DisplayNameCheck {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, errorKey: 'editProfile.nameRequired' };
  if (value.length > DISPLAY_NAME_MAX) return { ok: false, errorKey: 'editProfile.nameTooLong' };
  return { ok: true, value };
}

const ERROR_KEYS: Record<string, string> = {
  AVATAR_TOO_LARGE: 'editProfile.err.tooLarge',
  AVATAR_INVALID_TYPE: 'editProfile.err.invalidType',
  AVATAR_UPLOAD_FAILED: 'editProfile.err.uploadFailed',
  AVATAR_UNAVAILABLE: 'editProfile.err.unavailable',
  AVATAR_UPDATE_FAILED: 'editProfile.err.updateFailed',
  AVATAR_DELETE_FAILED: 'editProfile.err.updateFailed',
  RATE_LIMITED: 'editProfile.err.rateLimited',
  VALIDATION_ERROR: 'editProfile.err.validation',
  NETWORK_ERROR: 'editProfile.err.network',
  TIMEOUT: 'editProfile.err.network',
};

/** Mã lỗi API -> khoá i18n. Mã lạ rơi về lỗi chung của màn này. */
export function profileErrorKey(code: string | undefined): string {
  return (code && ERROR_KEYS[code]) || 'editProfile.err.generic';
}

/** Kiểm tra sớm trên máy để khỏi tải ảnh chắc chắn bị từ chối. Trả khoá lỗi hoặc null. */
export function avatarAssetProblem(asset: { fileSize?: number | null; mimeType?: string | null }): string | null {
  if (asset.mimeType && !(AVATAR_ALLOWED_TYPES as readonly string[]).includes(asset.mimeType.toLowerCase())) {
    return ERROR_KEYS.AVATAR_INVALID_TYPE;
  }
  if (typeof asset.fileSize === 'number' && asset.fileSize > AVATAR_MAX_BYTES) return ERROR_KEYS.AVATAR_TOO_LARGE;
  return null;
}

export function avatarUploadName(mimeType: string | null | undefined): { name: string; type: string } {
  const type = mimeType && (AVATAR_ALLOWED_TYPES as readonly string[]).includes(mimeType.toLowerCase()) ? mimeType.toLowerCase() : 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return { name: `avatar-${Date.now()}.${ext}`, type };
}
