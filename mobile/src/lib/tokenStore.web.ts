// Expo Go / Metro `--platform web` dùng được file này; bản native (tokenStore.ts) dùng SecureStore.
const ACCESS_KEY = 'palmsight.accessToken';
const REFRESH_KEY = 'palmsight.refreshToken';

const read = (key: string): string | null => globalThis.localStorage?.getItem(key) ?? null;
const write = (key: string, value: string | null) => {
  if (value === null) globalThis.localStorage?.removeItem(key);
  else globalThis.localStorage?.setItem(key, value);
};

export async function getAccessToken() {
  return read(ACCESS_KEY);
}

export async function getRefreshToken() {
  return read(REFRESH_KEY);
}

export async function saveSession(accessToken: string, refreshToken?: string | null) {
  write(ACCESS_KEY, accessToken);
  if (refreshToken) write(REFRESH_KEY, refreshToken);
}

export async function clearSession() {
  write(ACCESS_KEY, null);
  write(REFRESH_KEY, null);
}
