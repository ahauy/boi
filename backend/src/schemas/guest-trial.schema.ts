import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  collection: 'guest_trials',
  timestamps: { createdAt: true, updatedAt: false },
})
export class GuestTrial {
  _id: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    minlength: 64,
    maxlength: 64,
    trim: true,
  })
  fingerprintHash: string;

  @Prop({
    type: String,
    required: true,
    minlength: 64,
    maxlength: 64,
    trim: true,
  })
  ipHash: string;

  @Prop({
    type: String,
    required: true,
    minlength: 64,
    maxlength: 64,
    trim: true,
  })
  guestTokenHash: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Reading',
    required: true,
  })
  readingId: Types.ObjectId;

  @Prop({
    type: Boolean,
    default: false,
    required: true,
  })
  isClaimed: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  claimedByUserId?: Types.ObjectId | null;

  @Prop({
    type: Date,
    default: null,
  })
  claimedAt?: Date | null;

  @Prop({
    type: Date,
    required: true,
  })
  expiresAt: Date;

  createdAt: Date;
}

export type GuestTrialDocument = HydratedDocument<GuestTrial>;
export const GuestTrialSchema = SchemaFactory.createForClass(GuestTrial);

// 1. Prevent duplicate trial by fingerprint
GuestTrialSchema.index({ fingerprintHash: 1 }, { unique: true });

// 2. Lookup claim by token hash
GuestTrialSchema.index({ guestTokenHash: 1 }, { unique: true });

// 3. Sliding IP rate limit lookup
GuestTrialSchema.index({ ipHash: 1, createdAt: -1 });

// 4. TTL Index auto cleanup after expiresAt (7 days)
GuestTrialSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 5. Claim status indexing
GuestTrialSchema.index({ isClaimed: 1 });
