import { Platform } from 'react-native';
import * as Device from 'expo-device';

/**
 * Emulator / Play Integrity Gate (Playbook §3, §11.12)
 *
 * Pitfall §11.12:
 * Emulator sideloads (fake device model, wrong ABI) crash in SoLoader before JS runs
 * or generate invalid ad traffic. Block invalid/spoofed ABIs and unauthorized emulators
 * in production builds so blocked devices never initialize ads (§3).
 */

export type IntegrityFailureReason =
  | 'ok'
  | 'emulator_in_production'
  | 'invalid_abi'
  | 'spoofed_device_fingerprint'
  | 'play_integrity_failed';

export type PlayIntegrityVerdict =
  | 'MEETS_DEVICE_INTEGRITY'
  | 'MEETS_BASIC_INTEGRITY'
  | 'FAILED'
  | 'UNKNOWN';

export interface IntegrityCheckOptions {
  isDev?: boolean;
  platformOs?: string;
  isPhysicalDevice?: boolean;
  supportedAbis?: string[] | null;
  modelName?: string | null;
  brand?: string | null;
  allowEmulatorInProd?: boolean;
  playIntegrityVerdict?: PlayIntegrityVerdict;
}

export interface IntegrityCheckResult {
  passed: boolean;
  blocked: boolean;
  reason: IntegrityFailureReason;
  supportedAbis: string[];
}

export const ALLOWED_ANDROID_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64'] as const;

const SPOOFED_EMULATOR_TOKENS = [
  'sdk_gphone',
  'generic',
  'vbox86',
  'nox',
  'bluestacks',
  'ldplayer',
  'memu',
  'andy',
  'genymotion',
] as const;

let cachedBlockedState = false;
let currentPlayIntegrityVerdict: PlayIntegrityVerdict = 'UNKNOWN';

/**
 * Records a Play Integrity verdict obtained from the native Play Integrity API / server check.
 */
export function setPlayIntegrityVerdict(verdict: PlayIntegrityVerdict): void {
  currentPlayIntegrityVerdict = verdict;
  if (verdict === 'FAILED') {
    cachedBlockedState = true;
  }
}

/**
 * Evaluates device integrity and ABI validity (Playbook §3 & §11.12).
 * Blocked devices must never initialize ads.
 */
export function checkDeviceIntegrity(options: IntegrityCheckOptions = {}): IntegrityCheckResult {
  const isDev =
    options.isDev !== undefined
      ? options.isDev
      : typeof __DEV__ !== 'undefined'
        ? __DEV__
        : process.env.NODE_ENV !== 'production';

  const platformOs = options.platformOs ?? Platform.OS;
  const isPhysicalDevice = options.isPhysicalDevice ?? Boolean(Device.isDevice);
  const rawAbis = options.supportedAbis !== undefined ? options.supportedAbis : Device.supportedCpuArchitectures;
  const supportedAbis = Array.isArray(rawAbis) ? rawAbis.filter(Boolean) : [];
  const modelName = (options.modelName !== undefined ? options.modelName : Device.modelName) ?? '';
  const brand = (options.brand !== undefined ? options.brand : Device.brand) ?? '';
  const verdict = options.playIntegrityVerdict ?? currentPlayIntegrityVerdict;
  const allowEmulator =
    options.allowEmulatorInProd ?? process.env.EXPO_PUBLIC_ALLOW_EMULATOR === 'true';

  // 1. Explicit Play Integrity failure always blocks in any non-dev check
  if (verdict === 'FAILED') {
    cachedBlockedState = true;
    return {
      passed: false,
      blocked: true,
      reason: 'play_integrity_failed',
      supportedAbis,
    };
  }

  // In development builds or non-Android platforms, allow execution unless Play Integrity explicitly failed
  if (isDev || platformOs !== 'android') {
    cachedBlockedState = false;
    return {
      passed: true,
      blocked: false,
      reason: 'ok',
      supportedAbis,
    };
  }

  // 2. Production Android build: check physical device vs emulator sideload (§11.12)
  if (!isPhysicalDevice && !allowEmulator) {
    cachedBlockedState = true;
    return {
      passed: false,
      blocked: true,
      reason: 'emulator_in_production',
      supportedAbis,
    };
  }

  // 3. Production Android build: verify ABI compatibility (Pitfall §11.12)
  const hasValidAbi =
    supportedAbis.length > 0 &&
    supportedAbis.some((abi) =>
      (ALLOWED_ANDROID_ABIS as readonly string[]).includes(abi)
    );

  if (!hasValidAbi) {
    cachedBlockedState = true;
    return {
      passed: false,
      blocked: true,
      reason: 'invalid_abi',
      supportedAbis,
    };
  }

  // 4. Detect spoofed emulator model/brand fingerprints claiming to be physical devices
  const combinedFingerprint = `${brand} ${modelName}`.toLowerCase();
  const isSpoofedEmulator = SPOOFED_EMULATOR_TOKENS.some((token) =>
    combinedFingerprint.includes(token)
  );

  if (isSpoofedEmulator && !allowEmulator) {
    cachedBlockedState = true;
    return {
      passed: false,
      blocked: true,
      reason: 'spoofed_device_fingerprint',
      supportedAbis,
    };
  }

  cachedBlockedState = false;
  return {
    passed: true,
    blocked: false,
    reason: 'ok',
    supportedAbis,
  };
}

/**
 * Returns true if the device failed the integrity gate and must not initialize ads (§3).
 */
export function isDeviceBlocked(): boolean {
  return cachedBlockedState;
}

/**
 * Resets cached integrity gate state (for testing).
 */
export function resetIntegrityGate(): void {
  cachedBlockedState = false;
  currentPlayIntegrityVerdict = 'UNKNOWN';
}
