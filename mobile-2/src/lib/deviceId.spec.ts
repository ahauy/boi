import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'android' },
  getAndroidId: vi.fn<() => string>(),
  randomUUID: vi.fn<() => string>(),
  getItemAsync: vi.fn<(key: string) => Promise<string | null>>(),
  setItemAsync: vi.fn<(key: string, value: string) => Promise<void>>(),
}));

vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('expo-application', () => ({ getAndroidId: mocks.getAndroidId }));
vi.mock('expo-crypto', () => ({ randomUUID: mocks.randomUUID }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: mocks.getItemAsync,
  setItemAsync: mocks.setItemAsync,
}));

import { deviceSessionSchema } from '@palmsight/shared';
import { getDeviceId } from './deviceId';

const UUID = '3f2b1c9e-8a47-4d21-9b6e-0c5d7e1fa234';

describe('getDeviceId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platform.OS = 'android';
    mocks.getItemAsync.mockResolvedValue(null);
    mocks.setItemAsync.mockResolvedValue(undefined);
    mocks.getAndroidId.mockReturnValue('a1b2c3d4e5f60718');
    mocks.randomUUID.mockReturnValue(UUID);
  });

  it('keeps the stored id so an existing install stays on the same guest', async () => {
    mocks.getItemAsync.mockResolvedValue('stored-uuid-from-old-version');

    await expect(getDeviceId()).resolves.toBe('stored-uuid-from-old-version');
    expect(mocks.getAndroidId).not.toHaveBeenCalled();
    expect(mocks.randomUUID).not.toHaveBeenCalled();
    expect(mocks.setItemAsync).not.toHaveBeenCalled();
  });

  it('uses the prefixed Android ID when nothing is stored, and saves it', async () => {
    await expect(getDeviceId()).resolves.toBe('android-a1b2c3d4e5f60718');
    expect(mocks.setItemAsync).toHaveBeenCalledWith('palmsight.deviceId', 'android-a1b2c3d4e5f60718');
    expect(mocks.randomUUID).not.toHaveBeenCalled();
  });

  it('reads Android ID only once: later calls come from the store', async () => {
    const saved: { value: string | null } = { value: null };
    mocks.getItemAsync.mockImplementation(async () => saved.value);
    mocks.setItemAsync.mockImplementation(async (_key, value) => {
      saved.value = value;
    });

    await getDeviceId();
    await getDeviceId();
    await getDeviceId();

    expect(mocks.getAndroidId).toHaveBeenCalledTimes(1);
  });

  it('a short Android ID still passes the server schema thanks to the prefix', async () => {
    mocks.getAndroidId.mockReturnValue('a1b2c3d4');

    const deviceId = await getDeviceId();

    expect(deviceId).toBe('android-a1b2c3d4');
    await expect(deviceSessionSchema.validate({ deviceId })).resolves.toEqual({ deviceId });
  });

  it('falls back to a saved UUID when reading Android ID throws', async () => {
    mocks.getAndroidId.mockImplementation(() => {
      throw new Error('native module missing');
    });

    await expect(getDeviceId()).resolves.toBe(UUID);
    expect(mocks.setItemAsync).toHaveBeenCalledWith('palmsight.deviceId', UUID);
  });

  it.each([
    ['empty', ''],
    ['too short for the schema', 'abc'],
    ['invalid characters', 'a1b2:c3d4 e5f6'],
  ])('falls back to a UUID when Android ID is %s', async (_label, androidId) => {
    mocks.getAndroidId.mockReturnValue(androidId);

    await expect(getDeviceId()).resolves.toBe(UUID);
  });

  it('never reads Android ID on iOS', async () => {
    mocks.platform.OS = 'ios';

    await expect(getDeviceId()).resolves.toBe(UUID);
    expect(mocks.getAndroidId).not.toHaveBeenCalled();
  });
});
