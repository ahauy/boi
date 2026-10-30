import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ReferralStatus } from '@palmsight/shared';

@Schema({ collection: 'referrals', timestamps: { createdAt: true, updatedAt: false } })
export class Referral {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  referrerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  refereeId: Types.ObjectId;

  @Prop({ type: String, required: true, uppercase: true, trim: true })
  codeUsed: string;

  @Prop({ type: String, required: true, enum: Object.values(ReferralStatus) })
  status: ReferralStatus;

  createdAt: Date;
}

export type ReferralDocument = HydratedDocument<Referral>;
export const ReferralSchema = SchemaFactory.createForClass(Referral);

// Indexes according to database-erd.md:
// - { refereeId: 1 } unique
ReferralSchema.index({ refereeId: 1 }, { unique: true });

// - { referrerId: 1, createdAt: -1 }
ReferralSchema.index({ referrerId: 1, createdAt: -1 });
