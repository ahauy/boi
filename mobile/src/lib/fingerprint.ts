import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// Backend chặn guest theo hash của fingerprint nên thiết bị phải gửi một mã ổn định.
// Web dùng FingerprintJS; mobile không có API tương đương mà không cần native build,
// nên dùng một UUID sinh ngẫu nhiên đúng một lần và giữ vĩnh viễn trong AsyncStorage.
const FINGERPRINT_KEY = 'palmsight.guestFingerprint';

export async function getGuestFingerprint(): Promise<string> {
  const stored = await AsyncStorage.getItem(FINGERPRINT_KEY);
  if (stored) return stored;

  const generated = Crypto.randomUUID();
  await AsyncStorage.setItem(FINGERPRINT_KEY, generated);
  return generated;
}
