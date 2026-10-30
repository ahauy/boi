import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService Unit Logic (TC-004, TC-005, TC-006)', () => {
  let authService: AuthService;
  let pendingModel: any;
  let userModel: any;
  let sessionModel: any;
  let referralModel: any;
  let deletedIdentityModel: any;
  let readingModel: any;
  let guestTrialModel: any;
  let connection: any;
  let mailService: any;
  let creditLedgerService: any;

  beforeEach(() => {
    const configService = {
      get: vi.fn((key: string, def?: unknown) => {
        const map: Record<string, unknown> = {
          JWT_ACCESS_SECRET: 'test-jwt-access-secret-minimum-32-chars-long',
          JWT_ACCESS_TTL_SECONDS: 900,
          REFRESH_TOKEN_TTL_DAYS: 30,
          EMAIL_VERIFY_TTL_HOURS: 24,
          IDENTITY_HASH_SECRET: 'test-identity-secret-minimum-32-chars',
          SIGNUP_BONUS_CREDITS: 3,
          REFERRAL_REWARD_CREDITS: 2,
          REFEREE_REWARD_CREDITS: 1,
          REFERRAL_DAILY_CAP: 10,
        };
        return map[key] ?? def;
      }),
      getOrThrow: vi.fn((key: string) => {
        const map: Record<string, string> = {
          JWT_ACCESS_SECRET: 'test-jwt-access-secret-minimum-32-chars-long',
          IDENTITY_HASH_SECRET: 'test-identity-secret-minimum-32-chars',
        };
        return map[key] ?? 'default';
      }),
    } as unknown as ConfigService;

    mailService = {
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    } as unknown as MailService;
    creditLedgerService = {
      recordWithSession: vi.fn().mockResolvedValue(undefined),
      spendForReading: vi.fn().mockResolvedValue(undefined),
    } as unknown as CreditLedgerService;
    const jwtService = new JwtService({ secret: 'test-jwt-access-secret-minimum-32-chars-long' });

    // Mock models
    pendingModel = {
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      deleteOne: vi.fn(),
    };
    const mockExistsQuery = () => {
      const q: any = Promise.resolve(false);
      q.session = vi.fn().mockReturnValue(q);
      return q;
    };

    userModel = {
      exists: vi.fn().mockImplementation(mockExistsQuery),
      findOne: vi.fn(),
      create: vi.fn(),
    };
    sessionModel = {
      create: vi.fn().mockResolvedValue({ _id: 'session-id-1' }),
      deleteOne: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
    };
    referralModel = {
      countDocuments: vi.fn(),
      create: vi.fn(),
    };
    deletedIdentityModel = {
      exists: vi.fn(),
    };
    readingModel = {
      findOne: vi.fn(),
      create: vi.fn(),
    };
    guestTrialModel = {
      create: vi.fn(),
      updateOne: vi.fn(),
    };

    connection = {
      startSession: vi.fn(),
    };

    authService = new AuthService(
      pendingModel,
      userModel,
      sessionModel,
      referralModel,
      deletedIdentityModel,
      readingModel as any,
      guestTrialModel as any,
      mailService,
      creditLedgerService,
      jwtService,
      configService,
      connection,
    );
  });

  describe('TC-004: hashPassword & verifyPassword using Argon2id', () => {
    it('should hash password with argon2id prefix and verify correctly', async () => {
      const rawPassword = 'matkhau_123456';
      const hash = await authService.hashPassword(rawPassword);

      // Must start with $argon2id$
      expect(hash).toMatch(/^\$argon2id\$/);
      // Parameters: m=65536, t=3, p=4
      expect(hash).toContain('m=65536');
      expect(hash).toContain('t=3');
      expect(hash).toContain('p=4');

      // Verify correct password returns true
      const isValid = await authService.verifyPassword(rawPassword, hash);
      expect(isValid).toBe(true);

      // Verify incorrect password returns false
      const isInvalid = await authService.verifyPassword('sai_mat_khau', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('TC-005: generateVerificationToken', () => {
    it('should generate 43-character Base64URL raw token and 64-character SHA-256 hex tokenHash', () => {
      const { rawToken, tokenHash } = authService.generateVerificationToken();

      // rawToken must be exactly 43 URL-safe characters (32 bytes base64url)
      expect(rawToken).toHaveLength(43);
      expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

      // tokenHash must be 64-character hex string (SHA-256)
      expect(tokenHash).toHaveLength(64);
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);

      // tokenHash must match SHA-256 of rawToken
      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(tokenHash).toBe(expectedHash);
    });
  });

  describe('TC-006: generateReferralCode', () => {
    it('should generate 8 uppercase characters excluding ambiguous chars (0, O, 1, I, L)', async () => {
      for (let i = 0; i < 50; i++) {
        const code = await authService.generateReferralCode();

        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);

        // Disallowed characters
        expect(code).not.toContain('0');
        expect(code).not.toContain('O');
        expect(code).not.toContain('1');
        expect(code).not.toContain('I');
        expect(code).not.toContain('L');
      }
    });
  });

  describe('E11000 duplicate key error handling', () => {
    it('should catch E11000 on username in register and throw ConflictException with USERNAME_TAKEN', async () => {
      userModel.findOne.mockResolvedValue(null);
      pendingModel.findOne.mockResolvedValue(null);
      pendingModel.findOneAndUpdate.mockRejectedValue({
        code: 11000,
        keyPattern: { username: 1 },
        message: 'E11000 duplicate key error collection: pending_registrations index: username_1 dup key: { username: "taken_user" }',
      });

      await expect(
        authService.register({
          displayName: 'Test User',
          username: 'taken_user',
          email: 'test@example.com',
          password: 'Password_123',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'USERNAME_TAKEN',
          message: 'Tên người dùng đã được sử dụng.',
        },
      });
    });

    it('should catch E11000 on email in register and throw ConflictException with EMAIL_TAKEN', async () => {
      userModel.findOne.mockResolvedValue(null);
      pendingModel.findOne.mockResolvedValue(null);
      pendingModel.findOneAndUpdate.mockRejectedValue({
        code: 11000,
        keyPattern: { email: 1 },
        message: 'E11000 duplicate key error collection: pending_registrations index: email_1',
      });

      await expect(
        authService.register({
          displayName: 'Test User',
          username: 'valid_user',
          email: 'taken@example.com',
          password: 'Password_123',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'EMAIL_TAKEN',
          message: 'Email này đã được sử dụng.',
        },
      });
    });

    it('should throw ConflictException with EMAIL_TAKEN and OAuth message when registering with email of existing user without passwordHash', async () => {
      userModel.findOne.mockResolvedValue({
        email: 'oauth@example.com',
        username: 'oauth_user',
        passwordHash: null,
      });

      await expect(
        authService.register({
          displayName: 'Test User',
          username: 'valid_user',
          email: 'oauth@example.com',
          password: 'Password_123',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'EMAIL_TAKEN',
          message: 'Email này đã được liên kết với tài khoản Google hoặc Facebook. Vui lòng đăng nhập.',
        },
      });
    });

    it('should catch E11000 on username in verifyEmail and throw ConflictException with USERNAME_TAKEN', async () => {
      const mockSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
      };
      connection.startSession.mockResolvedValue(mockSession);

      const mockPending = {
        _id: 'pending123',
        email: 'test@example.com',
        username: 'taken_user',
        displayName: 'Test',
        passwordHash: 'hash',
        referralCode: null,
      };

      const pendingQuery = {
        session: vi.fn().mockResolvedValue(mockPending),
      };
      pendingModel.findOne.mockReturnValue(pendingQuery);

      const deletedIdentityQuery = {
        session: vi.fn().mockResolvedValue(false),
      };
      deletedIdentityModel.exists.mockReturnValue(deletedIdentityQuery);

      const userQuery = {
        session: vi.fn().mockResolvedValue(null),
      };
      userModel.findOne.mockReturnValue(userQuery);

      userModel.create.mockRejectedValue({
        code: 11000,
        keyPattern: { username: 1 },
        message: 'E11000 duplicate key error collection: users index: username_1',
      });

      await expect(
        authService.verifyEmail('raw-test-token-12345'),
      ).rejects.toMatchObject({
        response: {
          code: 'USERNAME_TAKEN',
          message: 'Tên người dùng đã được sử dụng.',
        },
      });

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('login unit logic (US-AUTH-002)', () => {
    it('should login successfully and return authResponse and rawRefreshToken', async () => {
      const passwordHash = await authService.hashPassword('Secret_123');
      const mockUser: any = {
        _id: '507f1f77bcf86cd799439011',
        displayName: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash,
        creditBalance: 3,
        referralCode: 'AB3K7XYZ',
        deletedAt: null,
      };

      userModel.findOne.mockResolvedValue(mockUser);

      const result = await authService.login({
        login: 'test@example.com',
        password: 'Secret_123',
      });

      expect(result.authResponse).toBeDefined();
      expect(result.authResponse.accessToken).toBeDefined();
      expect(result.authResponse.isNewUser).toBe(false);
      expect(result.authResponse.user.username).toBe('testuser');
      expect(result.rawRefreshToken).toBeDefined();
      expect(sessionModel.create).toHaveBeenCalled();
    });

    it('should revoke old session when currentRefreshToken is provided', async () => {
      const passwordHash = await authService.hashPassword('Secret_123');
      const mockUser: any = {
        _id: '507f1f77bcf86cd799439011',
        displayName: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash,
        creditBalance: 3,
        referralCode: 'AB3K7XYZ',
        deletedAt: null,
      };

      userModel.findOne.mockResolvedValue(mockUser);

      const oldRt = 'old_token_to_delete';
      const expectedOldHash = crypto.createHash('sha256').update(oldRt).digest('hex');

      await authService.login(
        { login: 'testuser', password: 'Secret_123' },
        oldRt,
      );

      expect(sessionModel.deleteOne).toHaveBeenCalledWith({ refreshTokenHash: expectedOldHash });
    });

    it('should throw EMAIL_NOT_VERIFIED when user does not exist but pending registration matches password', async () => {
      const pendingHash = await authService.hashPassword('Pending_123');
      userModel.findOne.mockResolvedValue(null);
      pendingModel.findOne.mockResolvedValue({
        email: 'pending@example.com',
        username: 'pending_user',
        passwordHash: pendingHash,
      });

      await expect(
        authService.login({
          login: 'pending@example.com',
          password: 'Pending_123',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Tài khoản chưa được xác minh email.',
          details: { email: 'pending@example.com' },
        },
      });
    });

    it('should throw INVALID_CREDENTIALS when deletedAt is not null', async () => {
      const passwordHash = await authService.hashPassword('Secret_123');
      const mockDeletedUser: any = {
        _id: '507f1f77bcf86cd799439011',
        email: 'deleted@example.com',
        passwordHash,
        deletedAt: new Date(),
      };
      userModel.findOne.mockResolvedValue(mockDeletedUser);

      await expect(
        authService.login({
          login: 'deleted@example.com',
          password: 'Secret_123',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'INVALID_CREDENTIALS',
          message: 'Thông tin đăng nhập không chính xác.',
        },
      });
    });

    it('should throw RATE_LIMITED after 5 failed consecutive attempts', async () => {
      userModel.findOne.mockResolvedValue(null);
      pendingModel.findOne.mockResolvedValue(null);

      const loginDto = { login: 'brute@example.com', password: 'bad_password' };
      const ip = '192.168.1.99';

      for (let i = 0; i < 5; i++) {
        await expect(authService.login(loginDto, undefined, ip)).rejects.toMatchObject({
          response: {
            code: 'INVALID_CREDENTIALS',
          },
        });
      }

      await expect(authService.login(loginDto, undefined, ip)).rejects.toMatchObject({
        response: {
          code: 'RATE_LIMITED',
          message: 'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.',
        },
      });
    });
  });

  describe('Guest Trial Claiming (TC-012, TC-013, TC-015)', () => {
    it('TC-015: register should persist claimToken in pendingModel.findOneAndUpdate', async () => {
      userModel.findOne.mockResolvedValue(null);
      pendingModel.findOne.mockResolvedValue(null);
      pendingModel.findOneAndUpdate.mockResolvedValue({});

      const claimToken = 'e4b8a21f-82df-4db3-9824-7128cf4291f0';
      const dto = {
        displayName: 'Test User',
        username: 'test_user',
        email: 'test@example.com',
        password: 'password123',
        claimToken,
      };

      const result = await authService.register(dto as any);
      expect(result.email).toBe('test@example.com');
      expect(pendingModel.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        expect.objectContaining({
          claimToken,
        }),
        expect.anything(),
      );
    });

    it('TC-012: verifyEmail with valid claimToken deducts 1 credit, marks reading DONE and returns balance 2', async () => {
      const mockSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
      };
      connection.startSession.mockResolvedValue(mockSession);

      const claimToken = 'e4b8a21f-82df-4db3-9824-7128cf4291f0';

      const mockPending = {
        _id: 'pending-id',
        email: 'trial@example.com',
        username: 'trialuser',
        displayName: 'Trial User',
        passwordHash: 'hashed_pw',
        claimToken,
      };

      const mockPendingQuery: any = Promise.resolve(mockPending);
      mockPendingQuery.session = vi.fn().mockReturnValue(mockPendingQuery);
      pendingModel.findOne.mockReturnValue(mockPendingQuery);
      pendingModel.deleteOne.mockReturnValue({ session: vi.fn().mockResolvedValue({}) });

      const mockUserQuery: any = Promise.resolve(null);
      mockUserQuery.session = vi.fn().mockReturnValue(mockUserQuery);
      userModel.findOne.mockReturnValue(mockUserQuery);

      const newUserDoc: any = {
        _id: 'new-user-id',
        displayName: 'Trial User',
        username: 'trialuser',
        email: 'trial@example.com',
        creditBalance: 3,
        referralCode: 'PALM1234',
        save: vi.fn().mockResolvedValue(true),
      };
      userModel.create.mockResolvedValue([newUserDoc]);

      const mockReadingDoc: any = {
        _id: 'reading-claim-id-1',
        userId: null,
        status: 'GUEST_PREVIEW',
        previewExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        save: vi.fn().mockResolvedValue(true),
      };
      const mockReadingQuery: any = Promise.resolve(mockReadingDoc);
      mockReadingQuery.session = vi.fn().mockReturnValue(mockReadingQuery);
      readingModel.findOne.mockReturnValue(mockReadingQuery);
      guestTrialModel.updateOne.mockReturnValue({ session: vi.fn().mockResolvedValue({}) });

      deletedIdentityModel.exists.mockReturnValue({ session: vi.fn().mockResolvedValue(false) });
      sessionModel.create.mockResolvedValue({ _id: 'session-id' });

      const { authResponse } = await authService.verifyEmail('valid-token', claimToken);

      expect(creditLedgerService.spendForReading).toHaveBeenCalledWith(
        'new-user-id',
        'reading-claim-id-1',
        mockSession,
      );
      expect(mockReadingDoc.status).toBe('DONE');
      expect(mockReadingDoc.previewExpiresAt).toBeNull();
      expect(mockReadingDoc.userId).toBe('new-user-id');
      expect(authResponse.user.creditBalance).toBe(2);
      expect(authResponse.claimedReadingId).toBe('reading-claim-id-1');
      expect(authResponse.claimFailed).toBeUndefined();
    });

    it('TC-013: verifyEmail with expired/non-existent claimToken preserves 3 credits and sets claimFailed = true', async () => {
      const mockSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
      };
      connection.startSession.mockResolvedValue(mockSession);

      const claimToken = '00000000-0000-4000-8000-000000000000';
      const mockPending = {
        _id: 'pending-id',
        email: 'expired@example.com',
        username: 'expireduser',
        displayName: 'Expired User',
        passwordHash: 'hashed_pw',
        claimToken,
      };

      const mockPendingQuery: any = Promise.resolve(mockPending);
      mockPendingQuery.session = vi.fn().mockReturnValue(mockPendingQuery);
      pendingModel.findOne.mockReturnValue(mockPendingQuery);
      pendingModel.deleteOne.mockReturnValue({ session: vi.fn().mockResolvedValue({}) });

      const mockUserQuery: any = Promise.resolve(null);
      mockUserQuery.session = vi.fn().mockReturnValue(mockUserQuery);
      userModel.findOne.mockReturnValue(mockUserQuery);

      const newUserDoc: any = {
        _id: 'new-user-id-2',
        displayName: 'Expired User',
        username: 'expireduser',
        email: 'expired@example.com',
        creditBalance: 3,
        referralCode: 'PALM5678',
        save: vi.fn().mockResolvedValue(true),
      };
      userModel.create.mockResolvedValue([newUserDoc]);

      const mockReadingQuery: any = Promise.resolve(null);
      mockReadingQuery.session = vi.fn().mockReturnValue(mockReadingQuery);
      readingModel.findOne.mockReturnValue(mockReadingQuery);

      deletedIdentityModel.exists.mockReturnValue({ session: vi.fn().mockResolvedValue(false) });
      sessionModel.create.mockResolvedValue({ _id: 'session-id' });

      const { authResponse } = await authService.verifyEmail('valid-token', claimToken);

      expect(creditLedgerService.spendForReading).not.toHaveBeenCalled();
      expect(authResponse.user.creditBalance).toBe(3);
      expect(authResponse.claimedReadingId).toBeNull();
      expect(authResponse.claimFailed).toBe(true);
    });
  });
});
