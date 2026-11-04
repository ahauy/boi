import { Platform } from 'react-native';

/**
 * Ranh giới giữa app và SDK quảng cáo.
 *
 * SDK ads (`react-native-google-mobile-ads`) là native module: không chạy trong Expo Go, không có
 * trên web, và cần App ID thật từ AdMob. App vì thế không import nó tĩnh — hàm chơi quảng cáo được
 * đăng ký lúc chạy bằng `setRewardedAdPlayer()`. Nhờ vậy toàn bộ luồng "xem quảng cáo đổi credit"
 * phía PalmSight vẫn chạy và test được trên web/Expo Go, còn bật quảng cáo thật chỉ là một lần cài cờ.
 */

export type RewardedAdOutcome = 'earned' | 'skipped';

export interface RewardedAdPlayRequest {
  /** Nonce một lần do backend cấp, đưa vào serverSideVerificationOptions của AdMob. */
  nonce: string;
  /** must khớp `REWARDED_AD_REWARD_ITEM` phía backend. */
  rewardItem: string;
  amount: number;
}

export type RewardedAdPlayer = (request: RewardedAdPlayRequest) => Promise<RewardedAdOutcome>;

let player: RewardedAdPlayer | null = null;

export function setRewardedAdPlayer(nextPlayer: RewardedAdPlayer | null): void {
  player = nextPlayer;
}

/** Cờ env là nguồn sự thật: tắt cờ là lời đề nghị biến mất khỏi app mà không cần bản build mới. */
export function rewardedAdsSupported(): boolean {
  return process.env.EXPO_PUBLIC_ADS_ENABLED === 'true' && player !== null && isNativePlatform();
}

export function isNativePlatform(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

export async function playRewardedAd(request: RewardedAdPlayRequest): Promise<RewardedAdOutcome> {
  if (!rewardedAdsSupported()) {
    throw new AdsUnavailableError();
  }
  return player!(request);
}

export class AdsUnavailableError extends Error {
  constructor() {
    super('Quảng cáo thưởng tạm không khả dụng trên thiết bị này.');
    this.name = 'AdsUnavailableError';
  }
}
