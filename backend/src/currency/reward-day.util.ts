import { ECONOMY_DEFAULTS } from '@palmsight/shared';

/**
 * Formats a Date into `YYYY-MM-DD` in the given IANA timezone (default `Asia/Ho_Chi_Minh`).
 */
export function getRewardDay(
  now: Date = new Date(),
  timeZone: string = ECONOMY_DEFAULTS.REWARD_TZ,
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/**
 * Computes integer calendar days between two `YYYY-MM-DD` strings (`toDay - fromDay`).
 */
export function diffRewardDays(fromDay: string, toDay: string): number {
  const [y1, m1, d1] = fromDay.split('-').map(Number);
  const [y2, m2, d2] = toDay.split('-').map(Number);
  if (
    !Number.isFinite(y1) ||
    !Number.isFinite(m1) ||
    !Number.isFinite(d1) ||
    !Number.isFinite(y2) ||
    !Number.isFinite(m2) ||
    !Number.isFinite(d2)
  ) {
    return 0;
  }
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (24 * 60 * 60 * 1000));
}

/**
 * Computes the next 00:00:00 boundary in `timeZone` and seconds remaining from `now`.
 */
export function getNextRewardReset(
  now: Date = new Date(),
  timeZone: string = ECONOMY_DEFAULTS.REWARD_TZ,
): { nextResetAt: string; secondsUntilReset: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const hourRaw = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const second = Number(parts.find((p) => p.type === 'second')?.value ?? '0');

  const elapsedSecondsInDay = hour * 3600 + minute * 60 + second;
  const secondsUntilReset = Math.max(1, 86400 - elapsedSecondsInDay);
  const nextResetDate = new Date(
    Math.floor(now.getTime() / 1000) * 1000 + secondsUntilReset * 1000,
  );

  return {
    nextResetAt: nextResetDate.toISOString(),
    secondsUntilReset,
  };
}
