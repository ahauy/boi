import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReadingSchool } from '@palmsight/shared';

const LAST_SCHOOL_KEY = 'palmsight.lastSchool';
const ONBOARDING_KEY = 'palmsight.onboardingCompleted';

export async function hasCompletedOnboarding(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

/** Web nhớ lựa chọn trường phái lần trước (mặc định EASTERN) — mobile giữ nguyên hành vi. */
export async function getLastSchool(): Promise<ReadingSchool> {
  const stored = await AsyncStorage.getItem(LAST_SCHOOL_KEY);
  return stored === ReadingSchool.WESTERN || stored === ReadingSchool.VEDIC ? stored : ReadingSchool.EASTERN;
}

export async function setLastSchool(school: ReadingSchool): Promise<void> {
  await AsyncStorage.setItem(LAST_SCHOOL_KEY, school);
}
