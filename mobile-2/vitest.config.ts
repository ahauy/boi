import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DEV__: 'true' },
  resolve: {
    alias: {
      'expo-constants': path.resolve(__dirname, 'src/test/expo-constants.stub.ts'),
      'expo-device': path.resolve(__dirname, 'src/test/expo-device.stub.ts'),
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
    env: {
      EXPO_PUBLIC_MAX_ANDROID_BANNER_ID: 'banner-unit',
      EXPO_PUBLIC_MAX_ANDROID_INTERSTITIAL_ID: 'interstitial-unit',
      EXPO_PUBLIC_MAX_ANDROID_REWARDED_ID: 'rewarded-unit',
      EXPO_PUBLIC_MAX_ANDROID_NATIVE_ID: 'native-unit',
      EXPO_PUBLIC_MAX_ANDROID_MREC_ID: 'mrec-unit',
    },
  },
});
