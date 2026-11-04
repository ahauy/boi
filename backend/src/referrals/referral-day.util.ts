const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Mốc 00:00 giờ Việt Nam của ngày chứa `now`; trần thưởng giới thiệu tính theo ngày này. */
export function startOfReferralDay(now: Date = new Date()): Date {
  const vnTime = new Date(now.getTime() + VN_OFFSET_MS);
  return new Date(
    Date.UTC(vnTime.getUTCFullYear(), vnTime.getUTCMonth(), vnTime.getUTCDate()) -
      VN_OFFSET_MS,
  );
}
