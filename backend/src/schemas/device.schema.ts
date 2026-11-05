import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'devices', timestamps: true })
export class Device {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  deviceIdHash: string;

  @Prop({ type: Date, default: null })
  starterGrantedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  starterUserId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, trim: true })
  starterIpHash?: string | null;

  @Prop({ type: String, default: null, trim: true })
  checkinDay?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  checkinUserId?: Types.ObjectId | null;

  /** Ngày thiết bị này đã nhận quà VIP hằng ngày và tài khoản nhận (chống nhận lại bằng tài khoản khác). */
  @Prop({ type: String, default: null, trim: true })
  vipDailyDay?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  vipDailyUserId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, trim: true })
  freeSpinDay?: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  freeSpinUserId?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  referralRedeemedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  referralRedeemedUserId?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export type DeviceDocument = HydratedDocument<Device>;
export const DeviceSchema = SchemaFactory.createForClass(Device);

DeviceSchema.index({ deviceIdHash: 1 }, { unique: true });
DeviceSchema.index({ starterIpHash: 1, starterGrantedAt: -1 });
