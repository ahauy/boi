/**
 * External Activity Tracker (Playbook §2.1, §6.3, §11.8)
 *
 * Records when the app itself sent the user outside the app:
 * ads, ad clicks, photo/camera pickers, system permission dialogs,
 * payment sheets (Google Play Billing), OAuth/browser sign-in, share sheet, browser tabs.
 *
 * Prevents wrongful paywall triggers on return from background within a 2-second grace period.
 */

export type ExternalActivityKind =
  | 'ad'
  | 'ad_click'
  | 'photo_picker'
  | 'permission'
  | 'payment'
  | 'auth'
  | 'share'
  | 'browser'
  | 'rewarded_ad';

const GRACE_PERIOD_MS = 2000;

interface ActiveActivity {
  kind: ExternalActivityKind;
  startedAt: number;
}

const activeActivities = new Map<ExternalActivityKind, ActiveActivity>();
let lastActivityEndedAt = 0;

/**
 * Record that an external activity has begun.
 */
export function recordExternalActivity(kind: ExternalActivityKind): void {
  activeActivities.set(kind, {
    kind,
    startedAt: Date.now(),
  });
}

/**
 * Record that an external activity has concluded.
 * Starts the 2-second grace period.
 */
export function finishExternalActivity(kind: ExternalActivityKind): void {
  if (activeActivities.has(kind)) {
    activeActivities.delete(kind);
    lastActivityEndedAt = Date.now();
  }
}

/**
 * Runs an async task wrapped with recordExternalActivity and finishExternalActivity.
 */
export async function runExternalActivity<T>(
  kind: ExternalActivityKind,
  action: () => Promise<T>
): Promise<T> {
  recordExternalActivity(kind);
  try {
    return await action();
  } finally {
    finishExternalActivity(kind);
  }
}

/**
 * Checks if any external activity is currently running or ended within the grace period (default 2s).
 */
export function isExternalActivityActive(withinGraceMs: number = GRACE_PERIOD_MS): boolean {
  if (activeActivities.size > 0) {
    return true;
  }
  return Date.now() - lastActivityEndedAt < withinGraceMs;
}

/**
 * Timestamp of the most recent concluded external activity.
 */
export function getLastExternalActivityEndTime(): number {
  return lastActivityEndedAt;
}

/**
 * Clear all records (useful in tests).
 */
export function resetExternalActivity(): void {
  activeActivities.clear();
  lastActivityEndedAt = 0;
}
