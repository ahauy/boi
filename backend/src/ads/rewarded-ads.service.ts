import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import crypto from 'node:crypto';
import {
  CREDIT_AMOUNTS,
  REWARDED_AD_CAP_WINDOW_MS,
  REWARDED_AD_INTENT_TTL_MS,
  REWARDED_AD_REWARD_ITEM,
  RewardedAdClaimStatus,
  type RewardedAdAvailabilityDto,
  type RewardedAdClaimStatusDto,
  type RewardedAdIntentResponseDto,
} from '@palmsight/shared';
import {
  RewardedAdClaim,
  RewardedAdClaimDocument,
} from '../schemas/rewarded-ad-claim.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import { RewardedAdSsvVerifier } from './rewarded-ad-ssv.verifier';

@Injectable()
export class RewardedAdsService {
  private readonly logger = new Logger(RewardedAdsService.name);

  constructor(
    @InjectModel(RewardedAdClaim.name)
    private readonly claimModel: Model<RewardedAdClaimDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly configService: ConfigService,
    private readonly creditLedgerService: CreditLedgerService,
    private readonly ssvVerifier: RewardedAdSsvVerifier
  ) {}

  isEnabled(): boolean {
    return this.configService.get<string>('REWARDED_ADS_ENABLED', 'false') === 'true';
  }

  /**
   * Dev-grant là cửa sau cấp credit không cần chữ ký nên mặc định tắt, và tắt hẳn khi
   * NODE_ENV=production để một cờ set nhầm trên máy chủ deploy không mở được cửa này.
   */
  isDevGrantEnabled(): boolean {
    if (this.configService.get<string>('NODE_ENV') === 'production') return false;
    return this.configService.get<string>('REWARDED_ADS_DEV_GRANT', 'false') === 'true';
  }

  async getAvailability(userId: Types.ObjectId): Promise<RewardedAdAvailabilityDto> {
    const dailyCap = this.dailyCap();
    return {
      enabled: this.isEnabled(),
      creditsPerAd: this.creditsPerAd(),
      dailyCap,
      remainingToday: Math.max(0, dailyCap - (await this.countInWindow(userId))),
    };
  }

  /**
   * Bước 1 của luồng: app xin một nonce một lần rồi nhét vào `serverSideVerificationOptions.userId`
   * của AdMob. Server mới là bên biết nonce nào thuộc về ai, nên client không thể tự nhận credit cho
   * tài khoản khác, và trần 24 giờ chặn được ngay ở đây thay vì chặn sau khi đã tốn lượt xem.
   */
  async createIntent(
    userId: Types.ObjectId,
    placement: string
  ): Promise<RewardedAdIntentResponseDto> {
    if (!this.isEnabled()) {
      throw new HttpException(
        { code: 'REWARDED_ADS_DISABLED', message: 'Tính năng này tạm chưa mở.' },
        HttpStatus.NOT_FOUND
      );
    }

    const dailyCap = this.dailyCap();
    const used = await this.countInWindow(userId);
    if (used >= dailyCap) {
      throw new HttpException(
        {
          code: 'REWARDED_AD_CAP_REACHED',
          message: 'Bạn đã xem hết lượt quảng cáo thưởng trong 24 giờ. Hãy quay lại sau.',
          details: { dailyCap, used },
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const expiresAt = new Date(Date.now() + this.intentTtlMs());
    const [claim] = await this.claimModel.create([
      {
        userId,
        nonce: crypto.randomBytes(16).toString('hex'),
        status: RewardedAdClaimStatus.ISSUED,
        rewardCredits: this.creditsPerAd(),
        placement,
        expiresAt,
      },
    ]);

    return {
      nonce: claim.nonce,
      creditsPerAd: claim.rewardCredits,
      // Claim vừa tạo đã chiếm một suất trong cửa sổ nên trừ thẳng, không đếm lại
      remainingToday: Math.max(0, dailyCap - used - 1),
      expiresAt: expiresAt.toISOString(),
      status: RewardedAdClaimStatus.ISSUED,
    };
  }

  /** Cho app polling xem callback của Google đã về chưa; endpoint này không cấp credit. */
  async getClaimStatus(
    userId: Types.ObjectId,
    nonce: string
  ): Promise<RewardedAdClaimStatusDto> {
    const claim = await this.claimModel.findOne({ userId, nonce }).lean();
    if (!claim) {
      throw new NotFoundException({
        code: 'REWARDED_AD_CLAIM_NOT_FOUND',
        message: 'Lượt xem quảng cáo này không còn hiệu lực.',
      });
    }

    const user = await this.userModel
      .findById(userId)
      .select('creditBalance')
      .lean();
    const dailyCap = this.dailyCap();

    return {
      status: claim.status,
      creditsEarned: claim.status === RewardedAdClaimStatus.REDEEMED ? claim.rewardCredits : 0,
      creditBalance: user?.creditBalance ?? 0,
      remainingToday: Math.max(0, dailyCap - (await this.countInWindow(userId))),
    };
  }

  /**
   * Bước 2: Google gọi thẳng vào endpoint công khai này sau khi user xem xong quảng cáo. Credit chỉ
   * được cộng khi chữ ký ECDSA khớp, `reward_item` đúng của PalmSight, và nonce còn ở ISSUED.
   */
  async redeemFromCallback(rawUrl: string): Promise<void> {
    const verified = await this.ssvVerifier.verifyCallback(rawUrl);
    if (!verified) {
      throw new HttpException(
        { code: 'AD_SSV_SIGNATURE_INVALID', message: 'Chữ ký xác minh quảng cáo không hợp lệ.' },
        HttpStatus.BAD_REQUEST
      );
    }

    const params = new Map(verified.pairs);
    const nonce = params.get('user_id') ?? '';
    const transactionId = params.get('transaction_id');
    const rewardItem = params.get('reward_item');
    const rewardAmount = Number(params.get('reward_amount'));

    if (!nonce) {
      throw new HttpException(
        { code: 'AD_SSV_SIGNATURE_INVALID', message: 'Callback thiếu user_id.' },
        HttpStatus.BAD_REQUEST
      );
    }

    // Chữ ký khớp đã chứng minh Google gửi callback này; kiểm tra còn lại chỉ để chắc nó tới từ ad
    // unit của PalmSight chứ không phải ad unit nào khác được cấu hình nhầm cùng endpoint.
    if (rewardItem !== REWARDED_AD_REWARD_ITEM || !(rewardAmount >= 1)) {
      throw new HttpException(
        { code: 'AD_SSV_REWARD_MISMATCH', message: 'Phần thưởng trong callback không khớp.' },
        HttpStatus.BAD_REQUEST
      );
    }

    const claim = await this.settle(nonce, transactionId ?? undefined);

    if (!claim) {
      const known = await this.claimModel.findOne({ nonce }).lean();
      // Retry của Google cho một nonce đã cấp rồi: trả 200 để không retry dây dưa
      if (known) {
        this.logger.log(`Callback SSV lặp lại cho nonce ${redact(nonce)} — bỏ qua`);
        return;
      }
      throw new NotFoundException({
        code: 'REWARDED_AD_CLAIM_NOT_FOUND',
        message: 'Lượt xem quảng cáo này không còn hiệu lực.',
      });
    }

    this.logger.log(
      `Cấp ${claim.rewardCredits} credit cho lượt xem quảng cáo (${claim.placement ?? 'n/a'})`
    );
  }

  /**
   * Cấp credit cho một lượt xem chỉ có trên máy phát triển.
   *
   * Lý do tồn tại: Google chỉ gọi được endpoint công khai, còn ad unit thử nghiệm của Google thì
   * không phát SSV, nên trên emulator không có đường nào để khoá tín dụng chạy trọn. Đường này bỏ
   * qua đúng một bước — chữ ký — và đi qua cùng `settle()` với SSV, nên trần 24 giờ, ledger, số dư
   * và polling của app vẫn là code thật. Bật bằng `REWARDED_ADS_DEV_GRANT=true`, chết hẳn ở production.
   */
  async devGrant(userId: Types.ObjectId, nonce: string): Promise<RewardedAdClaimStatusDto> {
    if (!this.isDevGrantEnabled()) {
      throw new NotFoundException({
        code: 'REWARDED_ADS_DISABLED',
        message: 'Tính năng này tạm chưa mở.',
      });
    }

    // Tra theo cả userId: nonce của user khác phải không tồn tại với người gọi, kể khi đang dev
    const mine = await this.claimModel.findOne({ userId, nonce }).lean();
    if (!mine) {
      throw new NotFoundException({
        code: 'REWARDED_AD_CLAIM_NOT_FOUND',
        message: 'Lượt xem quảng cáo này không còn hiệu lực.',
      });
    }

    await this.settle(nonce);
    return this.getClaimStatus(userId, nonce);
  }

  /**
   * Phần thưởng đổi thành credit: SSV và dev-grant cùng đi qua đây để hai đường không lệch nhau.
   *
   * ISSUED + chưa hết hạn nằm ngay trong điều kiện update: Google retry callback, và hai callback
   * đến cùng lúc chỉ được một bên sang tay được claim.
   */
  private async settle(
    nonce: string,
    transactionId?: string
  ): Promise<RewardedAdClaimDocument | null> {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const claim = await this.claimModel.findOneAndUpdate(
        {
          nonce,
          status: RewardedAdClaimStatus.ISSUED,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: {
            status: RewardedAdClaimStatus.REDEEMED,
            redeemedAt: new Date(),
            ...(transactionId ? { transactionId } : {}),
          },
        },
        { session, new: true }
      );

      if (!claim) {
        await session.abortTransaction();
        return null;
      }

      await this.creditLedgerService.grantRewardedAd(
        claim.userId,
        claim._id,
        claim.rewardCredits,
        session
      );

      await session.commitTransaction();
      return claim;
    } finally {
      await session.endSession();
    }
  }

  private async countInWindow(userId: Types.ObjectId): Promise<number> {
    const since = new Date(Date.now() - REWARDED_AD_CAP_WINDOW_MS);
    return this.claimModel.countDocuments({ userId, createdAt: { $gte: since } });
  }

  private creditsPerAd(): number {
    return Number(
      this.configService.get(
        'REWARDED_AD_REWARD_CREDITS',
        CREDIT_AMOUNTS.REWARDED_AD_REWARD
      )
    );
  }

  private dailyCap(): number {
    return Number(
      this.configService.get('REWARDED_AD_DAILY_CAP', CREDIT_AMOUNTS.REWARDED_AD_DAILY_CAP)
    );
  }

  private intentTtlMs(): number {
    return Number(
      this.configService.get('REWARDED_AD_INTENT_TTL_MS', REWARDED_AD_INTENT_TTL_MS)
    );
  }
}

/** Không ghi cả nonce vào log: ai cầm được nonce còn hiệu lực là chiếm được lượt thưởng đó. */
function redact(nonce: string): string {
  return nonce.length > 6 ? `${nonce.slice(0, 6)}…` : '…';
}
