import type {
  CreditTransactionListResponseDto,
  EnterReferralResponseDto,
  MeResponseDto,
  ReferralListResponseDto,
} from '@palmsight/shared';
import { get, post, put } from './api';

export function fetchMe(): Promise<MeResponseDto> {
  return get<MeResponseDto>('/me');
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return put<void>('/me/password', { currentPassword, newPassword });
}

export function enterReferralCode(code: string): Promise<EnterReferralResponseDto> {
  return post<EnterReferralResponseDto>('/me/referral', { code });
}

export function fetchReferrals(cursor?: string): Promise<ReferralListResponseDto> {
  return get<ReferralListResponseDto>(cursor ? `/me/referrals?cursor=${encodeURIComponent(cursor)}` : '/me/referrals');
}

export function fetchCreditTransactions(cursor?: string): Promise<CreditTransactionListResponseDto> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : '?limit=20';
  return get<CreditTransactionListResponseDto>(`/me/credit-transactions${query}`);
}
