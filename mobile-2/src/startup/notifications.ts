import { recordExternalActivity, finishExternalActivity } from '../lib/external-activity';

/**
 * Startup step 4 (Playbook §3). The system dialog counts as an app-caused trip (§6.3), so
 * closing it cannot open the paywall. Expo Go on Android has no module; the step is skipped.
 */
export async function requestNotificationPermission(): Promise<void> {
  let Notifications: typeof import('expo-notifications');
  try {
    Notifications = require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return;

  recordExternalActivity('permission');
  try {
    await Notifications.requestPermissionsAsync();
  } finally {
    finishExternalActivity('permission');
  }
}
