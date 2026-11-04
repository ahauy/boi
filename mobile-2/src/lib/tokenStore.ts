import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'palmsight.accessToken';
const REFRESH_KEY = 'palmsight.refreshToken';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function saveSession(accessToken: string, refreshToken?: string | null): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken),
    ...(refreshToken ? [SecureStore.setItemAsync(REFRESH_KEY, refreshToken)] : []),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
}
