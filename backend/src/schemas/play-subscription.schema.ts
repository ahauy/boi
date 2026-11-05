import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'play_subscriptions', timestamps: true })
export class PlaySubscription {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  purchaseToken: string;

  @Prop({ type: String, required: true, trim: true })
  productId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, default: null, trim: true })
  orderId?: string | null;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Boolean, default: true })
  willRenew: boolean;

  @Prop({ type: Boolean, default: false })
  isTrial: boolean;

  @Prop({ type: Number, default: null })
  priceAmountMicros?: number | null;

  @Prop({ type: String, default: null, trim: true })
  priceCurrencyCode?: string | null;

  @Prop({ type: Boolean, default: false })
  acknowledged: boolean;

  @Prop({ type: String, default: null, trim: true })
  supersededBy?: string | null;

  @Prop({ type: String, default: null, trim: true })
  adjustAdid?: string | null;

  @Prop({ type: String, default: null, trim: true })
  gaid?: string | null;

  @Prop({ type: Boolean, default: false })
  firstPurchaseCounted: boolean;

  @Prop({ type: Object, default: null })
  rawResponse?: Record<string, unknown> | null;

  createdAt: Date;
  updatedAt: Date;
}

export type PlaySubscriptionDocument = HydratedDocument<PlaySubscription>;
export const PlaySubscriptionSchema =
  SchemaFactory.createForClass(PlaySubscription);

PlaySubscriptionSchema.index({ purchaseToken: 1 }, { unique: true });
PlaySubscriptionSchema.index({ userId: 1, expiresAt: -1 });
PlaySubscriptionSchema.index({ expiresAt: 1 });
