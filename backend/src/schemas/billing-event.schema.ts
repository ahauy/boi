import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'billing_events', timestamps: true })
export class BillingEvent {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  eventId: string;

  @Prop({ type: String, required: true, trim: true })
  purchaseToken: string;

  @Prop({ type: Number, default: null })
  notificationType?: number | null;

  @Prop({ type: String, default: null, trim: true })
  productId?: string | null;

  @Prop({ type: Date, required: true, default: Date.now })
  processedAt: Date;

  @Prop({ type: Object, default: null })
  payload?: Record<string, unknown> | null;

  createdAt: Date;
  updatedAt: Date;
}

export type BillingEventDocument = HydratedDocument<BillingEvent>;
export const BillingEventSchema = SchemaFactory.createForClass(BillingEvent);

BillingEventSchema.index({ eventId: 1 }, { unique: true });
BillingEventSchema.index({ purchaseToken: 1, processedAt: -1 });
