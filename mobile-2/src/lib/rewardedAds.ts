import type {
  RewardedAdAvailabilityDto,
  RewardedAdClaimStatusDto,
  RewardedAdIntentResponseDto,
} from '@palmsight/shared';
import { REWARDED_AD_REWARD_ITEM, RewardedAdClaimStatus, RewardedAdPlacement } from '@palmsight/shared';
import { get, post } from './api';
import { playRewardedAd } from './ads';

export function fetchRewardedAvailability(): Promise<RewardedAdAvailabilityDto> {
  return get<RewardedAdAvailabilityDto>('/ads/rewarded/availability');
}

export function createRewardedIntent(
  placement: RewardedAdPlacement
): Promise<RewardedAdIntentResponseDto> {
  return post<RewardedAdIntentResponseDto>('/ads/rewarded/intent', { placement });
}

export function fetchRewardedClaimStatus(nonce: string): Promise<RewardedAdClaimStatusDto> {
  return get<RewardedAdClaimStatusDto>(`/ads/rewarded/status?nonce=${encodeURIComponent(nonce)}`);
}

export type RewardedAdResult =
  | {
      kind: 'granted';
      creditsEarned: number;
      creditBalance: number;
      remainingToday: number;
    }
  /** User đóng quảng cáo trước khi xem trọn nên không có phần thưởng. */
  | { kind: 'skipped' }
  /**
   * SDK báo đã xem xong nhưng callback của Google chưa về. Đây là trạng thái thật, không phải lỗi:
   * Google gửi callback bất đồng bộ và retry trong khoảng một giờ, nên app hẹn người dùng quay lại
   * thay vì báo mất credit.
   */
  | { kind: 'pending' };

const CONFIRM_POLL_MS = 1500;
const CONFIRM_TIMEOUT_MS = 20_000;

/**
 * Trọn một lượt "xem quảng cáo đổi credit".
 *
 * Thứ tự có chủ đích: xin nonce TRƯỚC khi cho xem, vì nonce là bằng chứng server dùng để đối chiếu
 * callback, và trần 24 giờ phải chặn ngay từ bước này để không đốt lượt xem của người dùng.
 * Credit không bao giờ được cộng ở đây — chỉ backend, sau chữ ký của Google.
 */
export async function earnRewardedCredit(
  placement: RewardedAdPlacement
): Promise<RewardedAdResult> {
  const intent = await createRewardedIntent(placement);

  const outcome = await playRewardedAd({
    nonce: intent.nonce,
    rewardItem: REWARDED_AD_REWARD_ITEM,
    amount: intent.creditsPerAd,
  });
  if (outcome !== 'earned') return { kind: 'skipped' };

  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const status: RewardedAdClaimStatusDto = await fetchRewardedClaimStatus(intent.nonce);
      if (status.status === RewardedAdClaimStatus.REDEEMED) {
        return {
          kind: 'granted',
          creditsEarned: status.creditsEarned,
          creditBalance: status.creditBalance,
          remainingToday: status.remainingToday,
        };
      }
    } catch {
      // Chưa có claim vì callback chưa về, hoặc mất mạng chốc lát: cứ thử lại tới hạn
    }
    await delay(CONFIRM_POLL_MS);
  }

  return { kind: 'pending' };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
