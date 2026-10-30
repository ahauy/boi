import { CreditTransactionType, ReferralStatus } from '../enums';
import { PaginatedResponseDto } from './common.dto';

export interface CreditTransactionDto {
  id: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  readingId?: string;
  referralId?: string;
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
