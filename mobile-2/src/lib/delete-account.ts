/**
 * Logic thuần của nút Xoá tài khoản (không import react-native để test được bằng vitest).
 * Không bao giờ hiển thị message tiếng Việt của server: chỉ ánh xạ mã lỗi sang khoá i18n.
 */

/** Mã lỗi của `DELETE /me` -> khoá i18n. Mã lạ rơi về lỗi chung. */
export function deleteAccountErrorKey(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined;
  if (code === 'IMAGE_DELETE_FAILED') return 'profile.deleteAccountImageFailed';
  return 'profile.deleteAccountFailed';
}
