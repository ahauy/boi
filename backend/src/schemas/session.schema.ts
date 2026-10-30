import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'sessions', timestamps: { createdAt: true, updatedAt: false } })
export class Session {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  refreshTokenHash: string;

  @Prop({ type: String, default: null, trim: true })
  userAgent?: string | null;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt?: Date | null;

  createdAt: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);

// Indexes according to database-erd.md:
// - { refreshTokenHash: 1 } unique
SessionSchema.index({ refreshTokenHash: 1 }, { unique: true });

// - { userId: 1 }
SessionSchema.index({ userId: 1 });

// - TTL { expiresAt: 1 }, { expireAfterSeconds: 0 }
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
