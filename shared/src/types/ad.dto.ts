import { RewardedAdClaimStatus, RewardedAdPlacement } from '../enums';

/** Trạng thái quảng cáo đổi credit, gửi kèm /me để app biết có nên hiện lời đề nghị hay không. */
export interface RewardedAdAvailabilityDto {
  /** Backend đã cấu hình khoá xác minh chữ ký AdMob hay chưa */
  enabled: boolean;
  creditsPerAd: number;
  dailyCap: number;
  remainingToday: number;
}

export interface RewardedAdIntentRequestDto {
  placement: RewardedAdPlacement;
}

/**
 * Nonce một lần mà app nhét vào `serverSideVerificationOptions.userId`. Chỉ server mới biết
 * nonce nào map với user nào, nên client không thể tự nhận credit cho tài khoản khác.
 */
export interface RewardedAdIntentResponseDto {
  nonce: string;
  creditsPerAd: number;
  remainingToday: number;
  expiresAt: string;
  status: RewardedAdClaimStatus.ISSUED;
}

export interface RewardedAdClaimStatusDto {
  status: RewardedAdClaimStatus;
  creditsEarned: number;
  creditBalance: number;
  remainingToday: number;
}
