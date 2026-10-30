import { describe, it, expect } from 'vitest';
import mongoose, { Types } from 'mongoose';
import {
  UserSchema,
  PendingRegistrationSchema,
  PasswordResetSchema,
  SessionSchema,
  ReferralSchema,
  ReadingSchema,
  CreditTransactionSchema,
  DeletedIdentitySchema,
  GuestTrialSchema,
} from '../src/schemas';
import {
  AuthProvider,
  ReferralStatus,
  ReadingSchool,
  ReadingStatus,
  HandOrientation,
  CreditTransactionType,
  DeletedIdentityKind,
} from '@palmsight/shared';
import { SYNC_TARGETS } from '../scripts/sync-indexes';

describe('SETUP-006: Mongoose Schemas & Indexes Verification', () => {
  describe('Collection Names', () => {
    it('should have exact snake_case collection names', () => {
      expect((UserSchema as unknown as { get: (k: string) => unknown }).get('collection')).toBe('users');
      expect((PendingRegistrationSchema as unknown as { get: (k: string) => unknown }).get('collection')).toBe('pending_registrations');
      expect((PasswordResetSchema as unknown as { get: (k: string) => unknown }).get('collection')).toBe('password_resets');
      expect((SessionSchema as unknown as { get: (k: string) => unknown }).get('collection')).toBe('sessions');
      expect((ReferralSchema as unknown as { get: (k: string) => unknown }).get('collection')).toBe('referrals');
      expect((ReadingSchema as unknown as { get: (k: string) => unknown }).get('collection')).toBe('readings');
      expect((CreditTransactionSchema as unknown as { get: (k: string) => unknown }).get('collection')).toBe('credit_transactions');
      expect((DeletedIdentitySchema as unknown as { get: (k: string) => unknown }).get('collection')).toBe('deleted_identities');
      expect((GuestTrialSchema as unknown as { get: (k: string) => unknown }).get('collection')).toBe('guest_trials');
    });
  });

  describe('UserSchema & Indexes', () => {
    it('should have all required indexes configured according to database-erd.md', () => {
      const indexes = UserSchema.indexes();

      // referralCode unique
      const refCodeIdx = indexes.find(([fields]) => fields.referralCode === 1);
      expect(refCodeIdx).toBeDefined();
      expect(refCodeIdx![1]).toMatchObject({ unique: true });

      // identities.provider + identities.providerUserId unique
      const identityIdx = indexes.find(
        ([fields]) => fields['identities.provider'] === 1 && fields['identities.providerUserId'] === 1,
      );
      expect(identityIdx).toBeDefined();
      expect(identityIdx![1]).toMatchObject({ unique: true, sparse: true });

      // email unique with partialFilterExpression
      const emailIdx = indexes.find(([fields]) => fields.email === 1);
      expect(emailIdx).toBeDefined();
      expect(emailIdx![1]).toMatchObject({
        unique: true,
        partialFilterExpression: { email: { $type: 'string' } },
      });

      // username unique with partialFilterExpression
      const usernameIdx = indexes.find(([fields]) => fields.username === 1);
      expect(usernameIdx).toBeDefined();
      expect(usernameIdx![1]).toMatchObject({
        unique: true,
        partialFilterExpression: { username: { $type: 'string' } },
      });
    });

    it('should validate creditBalance non-negative and integer', () => {
      const UserModel = mongoose.model('TestUserValidation', UserSchema);

      const invalidUserNegative = new UserModel({
        displayName: 'Test User',
        referralCode: 'ABCD1234',
        creditBalance: -1,
      });
      const negErr = invalidUserNegative.validateSync();
      expect(negErr?.errors.creditBalance).toBeDefined();

      const invalidUserFloat = new UserModel({
        displayName: 'Test User',
        referralCode: 'ABCD1234',
        creditBalance: 2.5,
      });
      const floatErr = invalidUserFloat.validateSync();
      expect(floatErr?.errors.creditBalance).toBeDefined();

      const validUser = new UserModel({
        displayName: 'Test User',
        referralCode: 'ABCD1234',
        creditBalance: 3,
        referralBlocked: false,
      });
      expect(validUser.validateSync()).toBeUndefined();
    });

    it('should validate username format (^[a-z0-9_]{3,20}$)', () => {
      const UserModel = mongoose.model('TestUserUsername', UserSchema);

      const invalidUser = new UserModel({
        displayName: 'Test User',
        referralCode: 'ABCD1234',
        username: 'Invalid-Username!',
      });
      const err = invalidUser.validateSync();
      expect(err?.errors.username).toBeDefined();

      const validUser = new UserModel({
        displayName: 'Test User',
        referralCode: 'ABCD1234',
        username: 'valid_user123',
      });
      expect(validUser.validateSync()).toBeUndefined();
    });

    it('should validate identities count (0-2) and provider enum', () => {
      const UserModel = mongoose.model('TestUserIdentities', UserSchema);

      const tooManyIdentities = new UserModel({
        displayName: 'Test User',
        referralCode: 'ABCD1234',
        identities: [
          { provider: AuthProvider.GOOGLE, providerUserId: 'g1' },
          { provider: AuthProvider.FACEBOOK, providerUserId: 'f1' },
          { provider: AuthProvider.GOOGLE, providerUserId: 'g2' },
        ],
      });
      const err = tooManyIdentities.validateSync();
      expect(err?.errors.identities).toBeDefined();
    });
  });

  describe('PendingRegistrationSchema & Indexes', () => {
    it('should have unique indexes on email, username, tokenHash, and TTL on expiresAt', () => {
      const indexes = PendingRegistrationSchema.indexes();

      const emailIdx = indexes.find(([fields]) => fields.email === 1);
      expect(emailIdx).toBeDefined();
      expect(emailIdx![1]).toMatchObject({ unique: true });

      const usernameIdx = indexes.find(([fields]) => fields.username === 1);
      expect(usernameIdx).toBeDefined();
      expect(usernameIdx![1]).toMatchObject({ unique: true });

      const tokenHashIdx = indexes.find(([fields]) => fields.tokenHash === 1);
      expect(tokenHashIdx).toBeDefined();
      expect(tokenHashIdx![1]).toMatchObject({ unique: true });

      const ttlIdx = indexes.find(([fields]) => fields.expiresAt === 1);
      expect(ttlIdx).toBeDefined();
      expect(ttlIdx![1]).toMatchObject({ expireAfterSeconds: 0 });
    });
  });

  describe('PasswordResetSchema & Indexes', () => {
    it('should have unique tokenHash, userId index, and TTL on expiresAt', () => {
      const indexes = PasswordResetSchema.indexes();

      const tokenHashIdx = indexes.find(([fields]) => fields.tokenHash === 1);
      expect(tokenHashIdx).toBeDefined();
      expect(tokenHashIdx![1]).toMatchObject({ unique: true });

      const userIdIdx = indexes.find(([fields]) => fields.userId === 1);
      expect(userIdIdx).toBeDefined();

      const ttlIdx = indexes.find(([fields]) => fields.expiresAt === 1);
      expect(ttlIdx).toBeDefined();
      expect(ttlIdx![1]).toMatchObject({ expireAfterSeconds: 0 });
    });
  });

  describe('SessionSchema & Indexes', () => {
    it('should have unique refreshTokenHash, userId index, and TTL on expiresAt', () => {
      const indexes = SessionSchema.indexes();

      const tokenHashIdx = indexes.find(([fields]) => fields.refreshTokenHash === 1);
      expect(tokenHashIdx).toBeDefined();
      expect(tokenHashIdx![1]).toMatchObject({ unique: true });

      const userIdIdx = indexes.find(([fields]) => fields.userId === 1);
      expect(userIdIdx).toBeDefined();

      const ttlIdx = indexes.find(([fields]) => fields.expiresAt === 1);
      expect(ttlIdx).toBeDefined();
      expect(ttlIdx![1]).toMatchObject({ expireAfterSeconds: 0 });
    });
  });

  describe('ReferralSchema & Indexes', () => {
    it('should have unique refereeId, and compound referrerId + createdAt index', () => {
      const indexes = ReferralSchema.indexes();

      const refereeIdx = indexes.find(([fields]) => fields.refereeId === 1);
      expect(refereeIdx).toBeDefined();
      expect(refereeIdx![1]).toMatchObject({ unique: true });

      const referrerIdx = indexes.find(
        ([fields]) => fields.referrerId === 1 && fields.createdAt === -1,
      );
      expect(referrerIdx).toBeDefined();
    });

    it('should validate status enum (REWARDED, CAPPED)', () => {
      const ReferralModel = mongoose.model('TestReferralValidation', ReferralSchema);

      const valid = new ReferralModel({
        referrerId: new Types.ObjectId(),
        refereeId: new Types.ObjectId(),
        codeUsed: 'ABCD1234',
        status: ReferralStatus.REWARDED,
      });
      expect(valid.validateSync()).toBeUndefined();

      const invalid = new ReferralModel({
        referrerId: new Types.ObjectId(),
        refereeId: new Types.ObjectId(),
        codeUsed: 'ABCD1234',
        status: 'INVALID_STATUS',
      });
      expect(invalid.validateSync()?.errors.status).toBeDefined();
    });
  });

  describe('ReadingSchema & Indexes', () => {
    it('should have userId+idempotencyKey unique, history index, and processing queue index', () => {
      const indexes = ReadingSchema.indexes();

      const idempotencyIdx = indexes.find(
        ([fields]) => fields.userId === 1 && fields.idempotencyKey === 1,
      );
      expect(idempotencyIdx).toBeDefined();
      expect(idempotencyIdx![1]).toMatchObject({ unique: true });

      const historyIdx = indexes.find(
        ([fields]) => fields.userId === 1 && fields.createdAt === -1,
      );
      expect(historyIdx).toBeDefined();

      const statusIdx = indexes.find(
        ([fields]) => fields.status === 1 && fields.createdAt === 1,
      );
      expect(statusIdx).toBeDefined();
    });

    it('should validate school, topics length >= 1, hand, and status', () => {
      const ReadingModel = mongoose.model('TestReadingValidation', ReadingSchema);

      const emptyTopics = new ReadingModel({
        userId: new Types.ObjectId(),
        idempotencyKey: '00000000-0000-0000-0000-000000000000',
        school: ReadingSchool.WESTERN,
        topics: [],
        hand: HandOrientation.LEFT,
        status: ReadingStatus.PROCESSING,
      });
      expect(emptyTopics.validateSync()?.errors.topics).toBeDefined();

      const valid = new ReadingModel({
        userId: new Types.ObjectId(),
        idempotencyKey: '12345678-1234-1234-1234-123456789abc',
        school: ReadingSchool.WESTERN,
        topics: ['personality', 'love'],
        hand: HandOrientation.RIGHT,
        status: ReadingStatus.DONE,
      });
      expect(valid.validateSync()).toBeUndefined();
    });
  });

  describe('CreditTransactionSchema & Indexes', () => {
    it('should have userId history and 3 partial unique indexes', () => {
      const indexes = CreditTransactionSchema.indexes();

      // userId + _id: -1
      const historyIdx = indexes.find(([fields]) => fields.userId === 1 && fields._id === -1);
      expect(historyIdx).toBeDefined();

      // SIGNUP_BONUS partial unique
      const signupIdx = indexes.find(([fields]) => fields.userId === 1 && fields.type === 1);
      expect(signupIdx).toBeDefined();
      expect(signupIdx![1]).toMatchObject({
        unique: true,
        partialFilterExpression: { type: 'SIGNUP_BONUS' },
      });

      // readingId partial unique
      const readingIdx = indexes.find(([fields]) => fields.readingId === 1 && fields.type === 1);
      expect(readingIdx).toBeDefined();
      expect(readingIdx![1]).toMatchObject({
        unique: true,
        partialFilterExpression: { readingId: { $exists: true } },
      });

      // referralId partial unique
      const referralIdx = indexes.find(([fields]) => fields.referralId === 1 && fields.type === 1);
      expect(referralIdx).toBeDefined();
      expect(referralIdx![1]).toMatchObject({
        unique: true,
        partialFilterExpression: { referralId: { $exists: true } },
      });
    });

    it('should validate amount is non-zero integer', () => {
      const TxModel = mongoose.model('TestTxValidation', CreditTransactionSchema);

      const zeroAmount = new TxModel({
        userId: new Types.ObjectId(),
        amount: 0,
        type: CreditTransactionType.SIGNUP_BONUS,
        balanceAfter: 3,
      });
      expect(zeroAmount.validateSync()?.errors.amount).toBeDefined();

      const floatAmount = new TxModel({
        userId: new Types.ObjectId(),
        amount: 1.5,
        type: CreditTransactionType.SIGNUP_BONUS,
        balanceAfter: 3,
      });
      expect(floatAmount.validateSync()?.errors.amount).toBeDefined();

      const validSpend = new TxModel({
        userId: new Types.ObjectId(),
        amount: -1,
        type: CreditTransactionType.READING_SPEND,
        balanceAfter: 2,
        readingId: new Types.ObjectId(),
      });
      expect(validSpend.validateSync()).toBeUndefined();
    });
  });

  describe('DeletedIdentitySchema & Indexes', () => {
    it('should have valueHmac unique index and valid kind', () => {
      const indexes = DeletedIdentitySchema.indexes();

      const hmacIdx = indexes.find(([fields]) => fields.valueHmac === 1);
      expect(hmacIdx).toBeDefined();
      expect(hmacIdx![1]).toMatchObject({ unique: true });

      const DelModel = mongoose.model('TestDelIdentityValidation', DeletedIdentitySchema);

      const valid = new DelModel({
        kind: DeletedIdentityKind.EMAIL,
        valueHmac: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      });
      expect(valid.validateSync()).toBeUndefined();

      const invalid = new DelModel({
        kind: 'PHONE',
        valueHmac: 'abcdef',
      });
      expect(invalid.validateSync()?.errors.kind).toBeDefined();
    });
  });

  describe('GuestTrialSchema & Indexes', () => {
    it('should have fingerprintHash unique, guestTokenHash unique, and expiresAt TTL index', () => {
      const indexes = GuestTrialSchema.indexes();

      const fpIdx = indexes.find(([fields]) => fields.fingerprintHash === 1);
      expect(fpIdx).toBeDefined();
      expect(fpIdx![1]).toMatchObject({ unique: true });

      const tokenIdx = indexes.find(([fields]) => fields.guestTokenHash === 1);
      expect(tokenIdx).toBeDefined();
      expect(tokenIdx![1]).toMatchObject({ unique: true });

      const ttlIdx = indexes.find(([fields]) => fields.expiresAt === 1);
      expect(ttlIdx).toBeDefined();
      expect(ttlIdx![1]).toMatchObject({ expireAfterSeconds: 0 });
    });
  });

  describe('sync-indexes targets', () => {
    it('should register all 9 schemas in SYNC_TARGETS', () => {
      expect(SYNC_TARGETS).toHaveLength(9);
      const names = SYNC_TARGETS.map((t) => t.name);
      expect(names).toEqual([
        'User',
        'PendingRegistration',
        'PasswordReset',
        'Session',
        'Referral',
        'Reading',
        'CreditTransaction',
        'DeletedIdentity',
        'GuestTrial',
      ]);
    });
  });
});
