import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { HandOrientation, PalmLineDto, ReadingSchool, ReadingStatus } from '@palmsight/shared';

@Schema({ collection: 'readings', timestamps: { createdAt: true, updatedAt: false } })
export class Reading {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, default: null })
  userId?: Types.ObjectId | null;

  @Prop({
    type: String,
    required: true,
    minlength: 36,
    maxlength: 36,
    validate: {
      validator: (val: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
      message: 'idempotencyKey must be a valid UUID v4',
    },
  })
  idempotencyKey: string;

  @Prop({ type: Boolean, default: false, required: true })
  isGuest: boolean;

  @Prop({ type: String, default: null, minlength: 64, maxlength: 64, trim: true })
  guestTokenHash?: string | null;

  @Prop({ type: String, required: true, enum: Object.values(ReadingSchool) })
  school: ReadingSchool;

  @Prop({
    type: [String],
    required: true,
    validate: {
      validator: (val: string[]) => Array.isArray(val) && val.length >= 1,
      message: 'topics must contain at least 1 topic',
    },
  })
  topics: string[];

  @Prop({ type: String, required: true, enum: Object.values(HandOrientation) })
  hand: HandOrientation;

  @Prop({ type: String, required: true, enum: Object.values(ReadingStatus) })
  status: ReadingStatus;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  result?: Record<string, unknown> | null;

  @Prop({ type: String, default: null, trim: true })
  imageUrl?: string | null;

  @Prop({ type: String, default: null, trim: true })
  annotatedImageUrl?: string | null;

  @Prop({ type: String, default: null, trim: true })
  imagePublicId?: string | null;

  @Prop({ type: String, default: null, trim: true })
  annotatedImagePublicId?: string | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  palmLines?: PalmLineDto[] | null;

  @Prop({ type: String, default: null, trim: true })
  rejectReason?: string | null;

  @Prop({ type: String, default: null, trim: true })
  aiProvider?: string | null;

  @Prop({ type: String, default: null, trim: true })
  aiModel?: string | null;

  @Prop({ type: String, default: null, trim: true })
  errorCode?: string | null;

  @Prop({ type: Number, default: null })
  latencyMs?: number | null;

  @Prop({ type: Date, default: null })
  previewExpiresAt?: Date | null;

  @Prop({ type: Date, default: null })
  claimedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  claimedByUserId?: Types.ObjectId | null;

  createdAt: Date;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export type ReadingDocument = HydratedDocument<Reading>;
export const ReadingSchema = SchemaFactory.createForClass(Reading);

ReadingSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } },
);

ReadingSchema.index({ userId: 1, createdAt: -1 });

ReadingSchema.index({ status: 1, createdAt: 1 });

ReadingSchema.index({ guestTokenHash: 1 }, { sparse: true });

ReadingSchema.index(
  { previewExpiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { previewExpiresAt: { $type: 'date' } } },
);
