import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'referral_network_counters' })
export class ReferralNetworkCounter {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true })
  ipHash: string;

  // Mốc 00:00 giờ Việt Nam của ngày tính lượt.
  @Prop({ type: Date, required: true })
  day: Date;

  @Prop({ type: Number, required: true, default: 0 })
  count: number;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export type ReferralNetworkCounterDocument =
  HydratedDocument<ReferralNetworkCounter>;
export const ReferralNetworkCounterSchema = SchemaFactory.createForClass(
  ReferralNetworkCounter,
);

ReferralNetworkCounterSchema.index({ ipHash: 1, day: 1 }, { unique: true });
ReferralNetworkCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
