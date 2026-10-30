import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'pending_registrations', timestamps: { createdAt: true, updatedAt: false } })
export class PendingRegistration {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  email: string;

  @Prop({
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [
      /^[a-z0-9_]{3,20}$/,
      'Username must be 3-20 characters long and contain only lowercase alphanumeric characters and underscores',
    ],
  })
  username: string;

  @Prop({ type: String, required: true, minlength: 1, maxlength: 50, trim: true })
  displayName: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

  @Prop({ type: String, default: null, uppercase: true, trim: true })
  referralCode?: string | null;

  @Prop({
    type: String,
    default: null,
    trim: true,
    validate: {
      validator: (val: string | null) =>
        val === null ||
        val === undefined ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
      message: 'claimToken must be a valid UUID v4',
    },
  })
  claimToken?: string | null;

  @Prop({ type: String, required: true, trim: true })
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  lastSentAt?: Date | null;

  createdAt: Date;
}

export type PendingRegistrationDocument = HydratedDocument<PendingRegistration>;
export const PendingRegistrationSchema =
  SchemaFactory.createForClass(PendingRegistration);

// Indexes according to database-erd.md:
// - { email: 1 } unique, { username: 1 } unique, { tokenHash: 1 } unique
PendingRegistrationSchema.index({ email: 1 }, { unique: true });
PendingRegistrationSchema.index({ username: 1 }, { unique: true });
PendingRegistrationSchema.index({ tokenHash: 1 }, { unique: true });

// - TTL { expiresAt: 1 }, { expireAfterSeconds: 0 }
PendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
