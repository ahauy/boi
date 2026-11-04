import { CreditTransactionType, ReferralStatus } from '../enums';
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
