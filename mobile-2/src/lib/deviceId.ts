import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Không có đăng nhập: backend nhận diện khách bằng mã này. SecureStore (Keychain) giữ mã
// qua lần cài lại trên iOS, còn Android thì mất — khi đó app tạo tài khoản khách mới.
const DEVICE_ID_KEY = 'palmsight.deviceId';

export async function getDeviceId(): Promise<string> {
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) return stored;

  const generated = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}
