import {
  AdRewardKind,
  AdRewardStatus,
  CreditTransactionType,
  ReferralStatus,
} from '../enums';
import { PaginatedResponseDto } from './common.dto';

export interface CreditTransactionDto {
  id: string;
  type: CreditTransactionType;
  reason?: string;
  amount: number;
  balanceAfter: number;
  readingId?: string;
  referralId?: string;
  adClaimId?: string;
  note?: string;
  createdAt: string;
}

export interface EnterReferralRequestDto {
  code: string;
}

export interface EnterReferralResponseDto {
  accepted: boolean;
  referrer: {
    displayName: string;
  };
  creditsEarned: number;
  creditBalance: number;
}

export interface ReferralListItemDto {
  displayName: string;
  status: ReferralStatus;
  creditsEarned: number;
  createdAt: string;
}

export interface ReferralListResponseDto {
  totalRewarded: number;
  totalCreditsEarned: number;
  items: ReferralListItemDto[];
  nextCursor: string | null;
}

export type CreditTransactionListResponseDto = PaginatedResponseDto<CreditTransactionDto>;

export interface AppConfigResponseDto {
  currency: string;
  pricePerAction: number;
  maxActionsPerTap: number;
  starterGrant: number;
  rewardTz: string;
  checkinLadder: number[];
  streakLength: number;
  milestones: Record<string, number>;
  restoreCostPerDay: number;
  restoreMaxMissed: number;
  wheelPrizes: number[];
  freeSpins: number;
  adSpins: number;
  gemSpinCost: number;
  checkinDoubleCap: number;
  bonusAdAmount: number;
  bonusAdCap: number;
  vipDaily: number;
  minAdWatchSeconds: number;
  legalUrls: {
    privacyUrl: string;
    termsUrl: string;
  };
}

export interface CheckinRestoreOfferDto {
  missedDays: number;
  cost: number;
  costPerDay: number;
  streakToKeep: number;
}

export interface CheckinMilestoneTargetDto {
  day: number;
  bonus: number;
}

export interface RewardedCounterDto {
  usedToday: number;
  cap: number;
  remaining: number;
  available?: boolean;
  amount?: number;
}

export interface CurrencyEarnCheckinStateDto {
  checkedInToday: boolean;
  deviceUsedToday: boolean;
  streakDays: number;
  nextDay: number;
  weekNumber: number;
  dayInWeek: number;
  todayAmount: number;
  ladder: number[];
  streakLength: number;
  milestones: Record<string, number>;
  nextMilestone: CheckinMilestoneTargetDto | null;
  restoreOffer: CheckinRestoreOfferDto | null;
  doubleAd: RewardedCounterDto;
}

export interface CurrencyEarnWheelStateDto {
  prizes: number[];
  freeSpinAvailable: boolean;
  freeSpinUsedByDevice: boolean;
  freeSpinsUsedToday: number;
  freeSpinsCap: number;
  adSpinsUsedToday: number;
  adSpinsCap: number;
  adSpinsRemaining: number;
  gemSpinCost?: number;
}

export interface CurrencyEarnRewardedStateDto {
  enabled: boolean;
  minWatchSeconds: number;
  checkinDouble: RewardedCounterDto;
  adSpin: RewardedCounterDto;
  bonus: RewardedCounterDto & { amount: number };
}

export interface CurrencyEarnResponseDto {
  balance?: number;
  rewardDay?: string;
  nextResetAt?: string;
  secondsUntilReset?: number;
  checkin?: CurrencyEarnCheckinStateDto;
  wheel?: CurrencyEarnWheelStateDto;
  rewarded?: CurrencyEarnRewardedStateDto;
  gemSpinCost?: number;
}

export interface CheckinClaimResponseDto {
  amount: number;
  streakDays: number;
  milestoneBonus: number;
  balance: number;
  rewardDay: string;
  alreadyClaimed?: boolean;
}

export interface CheckinRestoreResponseDto {
  costPaid: number;
  amount: number;
  streakDays: number;
  milestoneBonus: number;
  balance: number;
  rewardDay: string;
  checkedInToday: boolean;
}

export interface WheelSpinResponseDto {
  prizeIndex: number;
  amount: number;
  cost?: number;
  balance: number;
  rewardDay: string;
}

export interface CreateAdRewardRequestDto {
  kind: AdRewardKind;
}

export interface AdRewardTicketDto {
  id: string;
  ticketId: string;
  kind: AdRewardKind;
  status: AdRewardStatus;
  rewardDay: string;
  minWatchSeconds: number;
  createdAt: string;
}

export interface AdRewardClaimResponseDto {
  id: string;
  kind: AdRewardKind;
  status: AdRewardStatus;
  amount: number;
  prizeIndex: number | null;
  balance: number;
  rewardDay: string;
}

export interface AdRewardReleaseResponseDto {
  id: string;
  status: AdRewardStatus;
}

export interface BillingVerifyRequestDto {
  productId: string;
  purchaseToken: string;
  packageName?: string;
  orderId?: string | null;
  priceAmountMicros?: number | null;
  priceCurrencyCode?: string | null;
  isTrial?: boolean;
  obfuscatedAccountId?: string | null;
}

export interface BillingVerifyResponseDto {
  vip: {
    active: boolean;
    productId: string | null;
    expiresAt: string | null;
    willRenew: boolean;
  };
  firstPurchase: boolean;
  restored?: boolean;
  supersededPurchaseToken?: string | null;
  balance: number;
  grantedNow: boolean;
  vipDailyGranted?: number;
  billingRef: string;
}
