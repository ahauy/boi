import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { RewardedAdClaimStatus } from '@palmsight/shared';

/**
 * Một lượt "xem quảng cáo đổi credit" đi qua hai bước nên cần một document để nối chúng lại:
 * app xin nonce lúc bấm nút (ISSUED), Google gọi callback xác minh sau (REDEEMED).
 * Không có document này thì client tự báo "đã xem xong" là được credit.
 */
@Schema({
  collection: 'rewarded_ad_claims',
  timestamps: { createdAt: true, updatedAt: false },
})
export class RewardedAdClaim {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // Nonce một lần app nhét vào serverSideVerificationOptions.userId của AdMob
  @Prop({ type: String, required: true, trim: true })
  nonce: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(RewardedAdClaimStatus),
    default: RewardedAdClaimStatus.ISSUED,
  })
  status: RewardedAdClaimStatus;

  @Prop({ type: Number, required: true })
  rewardCredits: number;

  // admob_transaction_id: Google gửi lại cả chữ ký lẫn ID này khi retry, nên nó là khoá chống phát lại
  @Prop({ type: String, required: false, default: undefined, trim: true })
  transactionId?: string;

  @Prop({ type: String, required: false, default: undefined, trim: true })
  placement?: string;

  @Prop({ type: String, required: false, default: undefined, trim: true })
  adNetwork?: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: undefined })
  redeemedAt?: Date;

  createdAt: Date;
}

export type RewardedAdClaimDocument = HydratedDocument<RewardedAdClaim>;
export const RewardedAdClaimSchema = SchemaFactory.createForClass(RewardedAdClaim);

RewardedAdClaimSchema.index({ nonce: 1 }, { unique: true });

// Google retry callback nhiều lần: index này chặn cấp credit hai lần cho cùng một lượt xem
RewardedAdClaimSchema.index({ transactionId: 1 }, { unique: true, sparse: true });

// Đếm lượt đã dùng trong ngày theo thiết bị/tài khoản
RewardedAdClaimSchema.index({ userId: 1, createdAt: -1 });
