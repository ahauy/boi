/**
 * Quyền Android bị chặn trong bản build (tools:node="remove" trong manifest gộp).
 * Dùng bởi app.config.js; tách riêng để test được.
 *
 * - Luôn chặn: RECORD_AUDIO (app không ghi âm), USE_BIOMETRIC và USE_FINGERPRINT (do androidx.biometric
 *   kéo theo từ expo-secure-store; app không dùng `requireAuthentication` nên không bao giờ hỏi sinh trắc).
 * - Chỉ chặn ở bản phát hành (EAS profile preview/production): SYSTEM_ALERT_WINDOW. Quyền này do template
 *   prebuild của Expo đặt vào manifest chính cho mọi biến thể; chỉ debug/dev client mới cần (thanh công cụ
 *   dev của React Native vẽ đè lên ứng dụng khác). Không chặn ở dev để không làm hỏng overlay debug.
 *
 * Không chặn quyền do SDK quảng cáo, billing, camera, mạng hoặc phân tích cần: INTERNET, ACCESS_NETWORK_STATE,
 * ACCESS_WIFI_STATE, WAKE_LOCK, VIBRATE (expo-haptics), FOREGROUND_SERVICE (WorkManager), AD_ID, ACCESS_ADSERVICES_*,
 * BILLING, CAMERA.
 */
const ALWAYS_BLOCKED = [
  'android.permission.RECORD_AUDIO',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
];

const RELEASE_ONLY_BLOCKED = ['android.permission.SYSTEM_ALERT_WINDOW'];

const RELEASE_PROFILES = new Set(['preview', 'production']);

function isReleaseProfile(env) {
  return RELEASE_PROFILES.has(env.EAS_BUILD_PROFILE || '');
}

function blockedPermissionsFor(env, existing = []) {
  const merged = [...existing, ...ALWAYS_BLOCKED, ...(isReleaseProfile(env) ? RELEASE_ONLY_BLOCKED : [])];
  return [...new Set(merged)];
}

module.exports = { ALWAYS_BLOCKED, RELEASE_ONLY_BLOCKED, isReleaseProfile, blockedPermissionsFor };
