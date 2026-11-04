import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Không có đăng nhập: backend nhận diện khách bằng mã này, và các giới hạn theo thiết bị
// (quà khởi đầu, check-in, lượt quay miễn phí, referral) dựa trên nó. SecureStore giữ mã qua
// lần cài lại trên iOS nhưng Android thì mất, nên Android dùng Android ID để về đúng khách cũ.
// Mã đã lưu luôn được ưu tiên: bản cài sẵn giữ nguyên khách và số dư.
const DEVICE_ID_KEY = 'palmsight.deviceId';
const ANDROID_ID_PREFIX = 'android-';
// Khớp deviceSessionSchema trong shared; Android ID có thể ngắn hơn 16 ký tự nên cần tiền tố.
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function readAndroidDeviceId(): string | null {
  if (Platform.OS !== 'android') return null;
  try {
    const candidate = `${ANDROID_ID_PREFIX}${Application.getAndroidId()}`;
    return DEVICE_ID_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export async function getDeviceId(): Promise<string> {
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) return stored;

  const generated = readAndroidDeviceId() ?? Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}
