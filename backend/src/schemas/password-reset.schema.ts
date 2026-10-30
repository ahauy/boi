import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'password_resets', timestamps: { createdAt: true, updatedAt: false } })
export class PasswordReset {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  usedAt?: Date | null;

  createdAt: Date;
}

export type PasswordResetDocument = HydratedDocument<PasswordReset>;
export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);

// Indexes according to database-erd.md:
// - { tokenHash: 1 } unique
PasswordResetSchema.index({ tokenHash: 1 }, { unique: true });

// - { userId: 1 }
PasswordResetSchema.index({ userId: 1 });

// - TTL { expiresAt: 1 }, { expireAfterSeconds: 0 }
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
