import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AuthProvider } from '@palmsight/shared';

@Schema({ _id: false })
export class UserIdentity {
  @Prop({ type: String, required: true, enum: Object.values(AuthProvider) })
  provider: AuthProvider;

  @Prop({ type: String, required: true, trim: true })
  providerUserId: string;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  email?: string | null;

  @Prop({ type: Date, required: true, default: Date.now })
  linkedAt: Date;
}

export const UserIdentitySchema = SchemaFactory.createForClass(UserIdentity);

@Schema({ collection: 'users', timestamps: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, minlength: 1, maxlength: 50, trim: true })
  displayName: string;

  @Prop({
    type: String,
    default: null,
    lowercase: true,
    trim: true,
    validate: {
      validator: (val: string | null) =>
        val === null || /^[a-z0-9_]{3,20}$/.test(val),
      message:
        'Username must be 3-20 characters long and contain only lowercase alphanumeric characters and underscores',
    },
  })
  username?: string | null;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  email?: string | null;

  @Prop({ type: String, default: null })
  passwordHash?: string | null;

  @Prop({ type: Date, default: null })
  passwordUpdatedAt?: Date | null;

  @Prop({ type: String, default: null, trim: true })
  avatarUrl?: string | null;

  @Prop({
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    minlength: 8,
    maxlength: 8,
  })
  referralCode: string;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Credit balance cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Credit balance must be an integer',
    },
  })
  creditBalance: number;

  @Prop({
    type: [UserIdentitySchema],
    default: [],
    validate: {
      validator: (arr: UserIdentity[]) => Array.isArray(arr) && arr.length <= 2,
      message: 'User can have at most 2 linked identities',
    },
  })
  identities: UserIdentity[];

  @Prop({ type: Boolean, required: true, default: false })
  referralBlocked: boolean;

  // Khách dùng app không có email/mật khẩu: tài khoản gắn với một thiết bị duy nhất
  @Prop({ type: Boolean, required: true, default: false })
  isAnonymous: boolean;

  @Prop({ type: String, default: null, trim: true })
  deviceIdHash?: string | null;

  // Hash IP lúc tạo tài khoản ẩn danh — dùng để chặn tạo hàng loạt
  @Prop({ type: String, default: null, trim: true })
  signupIpHash?: string | null;

  @Prop({ type: Date, default: null })
  vipExpiresAt?: Date | null;

  @Prop({ type: String, default: null, trim: true })
  vipProductId?: string | null;

  @Prop({ type: Boolean, default: false })
  vipWillRenew?: boolean;

  @Prop({ type: String, default: null, trim: true })
  billingRef?: string | null;

  @Prop({ type: Date, default: null })
  starterGrantedAt?: Date | null;

  @Prop({ type: String, default: null, trim: true })
  checkinDay?: string | null;

  @Prop({ type: Number, default: 0, min: 0, max: 365 })
  checkinStreak?: number;

  @Prop({ type: String, default: null, trim: true })
  vipDailyDay?: string | null;

  createdAt: Date;
  updatedAt: Date;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// Indexes according to database-erd.md:
// - { referralCode: 1 } unique
UserSchema.index({ referralCode: 1 }, { unique: true });

// - { "identities.provider": 1, "identities.providerUserId": 1 } unique
UserSchema.index(
  { 'identities.provider': 1, 'identities.providerUserId': 1 },
  { unique: true, sparse: true },
);

// Một thiết bị chỉ ứng với một tài khoản ẩn danh; tài khoản thường không có field này
UserSchema.index(
  { deviceIdHash: 1 },
  {
    unique: true,
    partialFilterExpression: { deviceIdHash: { $type: 'string' } },
  },
);

// Đếm số tài khoản khách tạo từ một IP trong 24h
UserSchema.index({ isAnonymous: 1, signupIpHash: 1, createdAt: -1 });

// - { email: 1 } unique, partialFilterExpression: { email: { $type: "string" } }
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);

// - { username: 1 } unique, partialFilterExpression: { username: { $type: "string" } }
UserSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } },
);
