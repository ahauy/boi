import {
  AdRewardClaimResponseDto,
  AdRewardKind,
  AdRewardReleaseResponseDto,
  AdRewardTicketDto,
  CheckinClaimResponseDto,
  CheckinRestoreResponseDto,
  CurrencyEarnResponseDto,
  WheelSpinResponseDto,
} from '@palmsight/shared';
import { del, get, post } from '../lib/api';

/**
 * Earn & Currency API Client (Playbook §2.2, §7, §12 Phase 6)
 *
 * Endpoints:
 * - GET /api/v1/currency/earn
 * - POST /api/v1/currency/checkin
 * - POST /api/v1/currency/checkin/restore
 * - POST /api/v1/currency/spin
 * - POST /api/v1/currency/paid-spin
 * - POST /api/v1/currency/ad-rewards
 * - POST /api/v1/currency/ad-rewards/:id/claim
 * - DELETE /api/v1/currency/ad-rewards/:id
 */

export async function fetchCurrencyEarn(): Promise<CurrencyEarnResponseDto> {
  return get<CurrencyEarnResponseDto>('/currency/earn');
}

export async function claimCheckin(): Promise<CheckinClaimResponseDto> {
  return post<CheckinClaimResponseDto>('/currency/checkin');
}

export async function restoreCheckin(): Promise<CheckinRestoreResponseDto> {
  return post<CheckinRestoreResponseDto>('/currency/checkin/restore');
}

export async function spinFreeWheel(): Promise<WheelSpinResponseDto> {
  return post<WheelSpinResponseDto>('/currency/spin');
}

export async function spinPaidWheel(): Promise<WheelSpinResponseDto> {
  return post<WheelSpinResponseDto>('/currency/paid-spin');
}

export async function createAdReward(kind: AdRewardKind): Promise<AdRewardTicketDto> {
  return post<AdRewardTicketDto>('/currency/ad-rewards', { kind });
}

export async function claimAdReward(
  id: string
): Promise<AdRewardClaimResponseDto> {
  return post<AdRewardClaimResponseDto>(`/currency/ad-rewards/${id}/claim`);
}

export async function releaseAdReward(
  id: string
): Promise<AdRewardReleaseResponseDto> {
  return del<AdRewardReleaseResponseDto>(`/currency/ad-rewards/${id}`);
}


