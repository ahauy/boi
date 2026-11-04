export enum ReadingSchool {
  WESTERN = "WESTERN",
  EASTERN = "EASTERN",
  VEDIC = "VEDIC",
}

export enum LifeAspect {
  PERSONALITY = "personality",
  LOVE = "love",
  CAREER = "career",
  FINANCE = "finance",
  HEALTH = "health",
  FAMILY = "family",
}

export enum ReadingStatus {
  PROCESSING = "PROCESSING",
  DONE = "DONE",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
  GUEST_PREVIEW = "GUEST_PREVIEW",
}

export enum CreditTransactionType {
  SIGNUP_BONUS = "SIGNUP_BONUS",
  REFERRAL_BONUS = "REFERRAL_BONUS",
  REFEREE_BONUS = "REFEREE_BONUS",
  READING_SPEND = "READING_SPEND",
  READING_REFUND = "READING_REFUND",
  REWARDED_AD = "REWARDED_AD",
  ADMIN_ADJUST = "ADMIN_ADJUST",
  STARTER = "starter",
  SINGLE = "single",
  REFUND = "refund",
  CHECKIN = "checkin",
  CHECKIN_MILESTONE = "checkin_milestone",
  CHECKIN_RESTORE = "checkin_restore",
  AD_REWARD = "ad_reward",
  WHEEL = "wheel",
  WHEEL_SPIN = "wheel_spin",
  VIP_DAILY = "vip_daily",
  GUEST_MERGE = "guest_merge",
  OPERATOR = "operator",
}

export enum LedgerReason {
  STARTER = "starter",
  SINGLE = "single",
  REFUND = "refund",
  CHECKIN = "checkin",
  CHECKIN_MILESTONE = "checkin_milestone",
  CHECKIN_RESTORE = "checkin_restore",
  AD_REWARD = "ad_reward",
  WHEEL = "wheel",
  WHEEL_SPIN = "wheel_spin",
  VIP_DAILY = "vip_daily",
  GUEST_MERGE = "guest_merge",
  OPERATOR = "operator",
}

export enum RewardedAdClaimStatus {
  ISSUED = "ISSUED",
  REDEEMED = "REDEEMED",
}

/** Nơi app hiện lời đề nghị xem quảng cáo; ghi vào claim để đo chỗ nào hiệu quả. */
export enum RewardedAdPlacement {
  WALLET = "wallet",
  OUT_OF_CREDITS = "out_of_credits",
}

export enum ImageQuality {
  GOOD = "GOOD",
  FAIR = "FAIR",
  POOR = "POOR",
}

export enum HandOrientation {
  LEFT = "LEFT",
  RIGHT = "RIGHT",
}

export const HandSide = HandOrientation;
export type HandSide = HandOrientation;

export enum AuthProvider {
  GOOGLE = "GOOGLE",
  FACEBOOK = "FACEBOOK",
}

export enum ReferralStatus {
  REWARDED = "REWARDED",
  CAPPED = "CAPPED",
}

export enum DeletedIdentityKind {
  EMAIL = "EMAIL",
  GOOGLE = "GOOGLE",
  FACEBOOK = "FACEBOOK",
}
