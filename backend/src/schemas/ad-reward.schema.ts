import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AdRewardKind, AdRewardStatus } from '@palmsight/shared';

@Schema({ collection: 'ad_rewards', timestamps: true })
export class AdReward {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, default: null, trim: true })
  deviceIdHash?: string | null;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(AdRewardKind),
  })
  kind: AdRewardKind;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(AdRewardStatus),
    default: AdRewardStatus.PENDING,
  })
  status: AdRewardStatus;

  @Prop({ type: String, required: true, trim: true })
  rewardDay: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'amount must be an integer',
    },
  })
  amount: number;

  @Prop({ type: Number, default: null })
  prizeIndex?: number | null;

  @Prop({ type: Date, default: null })
  claimedAt?: Date | null;

  @Prop({ type: Date, default: null })
  releasedAt?: Date | null;

  @Prop({
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 48 * 60 * 60 * 1000),
  })
  purgeAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type AdRewardDocument = HydratedDocument<AdReward>;
export const AdRewardSchema = SchemaFactory.createForClass(AdReward);

AdRewardSchema.index({ userId: 1, rewardDay: 1, kind: 1, status: 1 });
AdRewardSchema.index(
  { deviceIdHash: 1, rewardDay: 1, kind: 1, status: 1 },
  { partialFilterExpression: { deviceIdHash: { $type: 'string' } } },
);
AdRewardSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
