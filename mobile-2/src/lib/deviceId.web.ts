import * as Crypto from 'expo-crypto';

// Bản web không có SecureStore: localStorage đủ để giữ mã thiết bị cho bản xem trước.
const DEVICE_ID_KEY = 'palmsight.deviceId';

export async function getDeviceId(): Promise<string> {
  const stored = globalThis.localStorage?.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const generated = Crypto.randomUUID();
  globalThis.localStorage?.setItem(DEVICE_ID_KEY, generated);
  return generated;
}
