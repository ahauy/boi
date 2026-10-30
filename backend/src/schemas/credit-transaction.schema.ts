import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CreditTransactionType } from '@palmsight/shared';

@Schema({
  collection: 'credit_transactions',
  timestamps: { createdAt: true, updatedAt: false },
})
export class CreditTransaction {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: Number,
    required: true,
    validate: {
      validator: (val: number) => Number.isInteger(val) && val !== 0,
      message: 'amount must be a non-zero integer',
    },
  })
  amount: number;

  @Prop({ type: String, required: true, enum: Object.values(CreditTransactionType) })
  type: CreditTransactionType;

  @Prop({
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: 'balanceAfter must be an integer',
    },
  })
  balanceAfter: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Reading',
    required: false,
    default: undefined,
    set: (v: unknown) => (v === null ? undefined : v),
  })
  readingId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Referral',
    required: false,
    default: undefined,
    set: (v: unknown) => (v === null ? undefined : v),
  })
  referralId?: Types.ObjectId;

  @Prop({ type: String, required: false, trim: true, default: undefined })
  note?: string;

  createdAt: Date;
}

export type CreditTransactionDocument = HydratedDocument<CreditTransaction>;
export const CreditTransactionSchema =
  SchemaFactory.createForClass(CreditTransaction);

// Indexes according to database-erd.md:
// - { userId: 1, _id: -1 }
CreditTransactionSchema.index({ userId: 1, _id: -1 });

// - { userId: 1, type: 1 } unique, partialFilterExpression: { type: "SIGNUP_BONUS" }
CreditTransactionSchema.index(
  { userId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'SIGNUP_BONUS' } },
);

// - { readingId: 1, type: 1 } unique, partialFilterExpression: { readingId: { $exists: true } }
CreditTransactionSchema.index(
  { readingId: 1, type: 1 },
  { unique: true, partialFilterExpression: { readingId: { $exists: true } } },
);

// - { referralId: 1, type: 1 } unique, partialFilterExpression: { referralId: { $exists: true } }
CreditTransactionSchema.index(
  { referralId: 1, type: 1 },
  { unique: true, partialFilterExpression: { referralId: { $exists: true } } },
);
