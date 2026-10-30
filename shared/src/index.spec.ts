import { describe, it, expect } from 'vitest';
import {
  ReadingSchool,
  LifeAspect,
  ReadingStatus,
  CreditTransactionType,
  ImageQuality,
  HandOrientation,
  READING_SCHOOLS,
  READING_SCHOOL_LIST,
  LIFE_ASPECTS,
  CREDIT_AMOUNTS,
  registerSchema,
  registerFormSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  enterReferralSchema,
  palmResultSchema,
} from './index';

describe('@palmsight/shared', () => {
  describe('Enums', () => {
    it('should have correct ReadingSchool values', () => {
      expect(ReadingSchool.WESTERN).toBe('WESTERN');
      expect(ReadingSchool.EASTERN).toBe('EASTERN');
      expect(ReadingSchool.VEDIC).toBe('VEDIC');
    });

    it('should have correct LifeAspect values', () => {
      expect(LifeAspect.PERSONALITY).toBe('personality');
      expect(LifeAspect.LOVE).toBe('love');
      expect(LifeAspect.CAREER).toBe('career');
      expect(LifeAspect.FINANCE).toBe('finance');
      expect(LifeAspect.HEALTH).toBe('health');
      expect(LifeAspect.FAMILY).toBe('family');
    });

    it('should have correct ReadingStatus values', () => {
      expect(ReadingStatus.PROCESSING).toBe('PROCESSING');
      expect(ReadingStatus.DONE).toBe('DONE');
      expect(ReadingStatus.FAILED).toBe('FAILED');
      expect(ReadingStatus.REJECTED).toBe('REJECTED');
    });

    it('should have correct CreditTransactionType values', () => {
      expect(CreditTransactionType.SIGNUP_BONUS).toBe('SIGNUP_BONUS');
      expect(CreditTransactionType.REFERRAL_BONUS).toBe('REFERRAL_BONUS');
      expect(CreditTransactionType.REFEREE_BONUS).toBe('REFEREE_BONUS');
      expect(CreditTransactionType.READING_SPEND).toBe('READING_SPEND');
      expect(CreditTransactionType.READING_REFUND).toBe('READING_REFUND');
      expect(CreditTransactionType.ADMIN_ADJUST).toBe('ADMIN_ADJUST');
    });

    it('should have correct ImageQuality values', () => {
      expect(ImageQuality.GOOD).toBe('GOOD');
      expect(ImageQuality.FAIR).toBe('FAIR');
      expect(ImageQuality.POOR).toBe('POOR');
    });

    it('should have correct HandOrientation values', () => {
      expect(HandOrientation.LEFT).toBe('LEFT');
      expect(HandOrientation.RIGHT).toBe('RIGHT');
    });
  });

  describe('Constants', () => {
    it('should have correct CREDIT_AMOUNTS', () => {
      expect(CREDIT_AMOUNTS.SIGNUP_BONUS).toBe(3);
      expect(CREDIT_AMOUNTS.REFERRAL_REWARD).toBe(2);
      expect(CREDIT_AMOUNTS.REFEREE_REWARD).toBe(1);
      expect(CREDIT_AMOUNTS.READING_COST).toBe(1);
      expect(CREDIT_AMOUNTS.REFERRAL_DAILY_CAP).toBe(10);
    });

    it('should have 3 reading schools with non-empty sections', () => {
      expect(READING_SCHOOL_LIST).toHaveLength(3);
      expect(READING_SCHOOLS[ReadingSchool.WESTERN].sections.length).toBeGreaterThan(0);
      expect(READING_SCHOOLS[ReadingSchool.EASTERN].sections.length).toBeGreaterThan(0);
      expect(READING_SCHOOLS[ReadingSchool.VEDIC].sections.length).toBeGreaterThan(0);
    });

    it('should have 6 life aspects', () => {
      expect(LIFE_ASPECTS).toHaveLength(6);
    });
  });

  describe('Yup Schemas', () => {
    describe('registerSchema & registerFormSchema (TC-001, TC-002, TC-003)', () => {
      it('TC-001: should validate valid registration input, lowercase username/email and uppercase referralCode', async () => {
        const input = {
          displayName: 'Nguyễn Văn A',
          username: '  nguyenvana  ',
          email: '  nguyenvana@example.com  ',
          password: 'matkhau_123456',
          referralCode: 'k7qx4mzp',
        };
        const validated = await registerSchema.validate(input);
        expect(validated.displayName).toBe('Nguyễn Văn A');
        expect(validated.username).toBe('nguyenvana');
        expect(validated.email).toBe('nguyenvana@example.com');
        expect(validated.password).toBe('matkhau_123456');
        expect(validated.referralCode).toBe('K7QX4MZP');
      });

      it('TC-002: should reject invalid registration boundary values', async () => {
        // username too short
        await expect(
          registerSchema.validate({
            displayName: 'A',
            username: 'ab',
            email: 'test@example.com',
            password: 'validPassword123',
          }),
        ).rejects.toThrow('Username chỉ gồm chữ thường, số, dấu gạch dưới, từ 3-20 ký tự');

        // username invalid chars
        await expect(
          registerSchema.validate({
            displayName: 'A',
            username: 'user@domain',
            email: 'test@example.com',
            password: 'validPassword123',
          }),
        ).rejects.toThrow('Username chỉ gồm chữ thường, số, dấu gạch dưới, từ 3-20 ký tự');

        // invalid email
        await expect(
          registerSchema.validate({
            displayName: 'A',
            username: 'validuser',
            email: 'email-khong-hop-le',
            password: 'validPassword123',
          }),
        ).rejects.toThrow('Email không đúng định dạng');

        // password too short
        await expect(
          registerSchema.validate({
            displayName: 'A',
            username: 'validuser',
            email: 'test@example.com',
            password: '12345',
          }),
        ).rejects.toThrow('Mật khẩu phải có ít nhất 8 ký tự');

        // password equals username or email
        await expect(
          registerSchema.validate({
            displayName: 'A',
            username: 'nguyenvana',
            email: 'test@example.com',
            password: 'nguyenvana',
          }),
        ).rejects.toThrow('Mật khẩu không được trùng với username hoặc email');

        await expect(
          registerSchema.validate({
            displayName: 'A',
            username: 'validuser',
            email: 'test@example.com',
            password: 'test@example.com',
          }),
        ).rejects.toThrow('Mật khẩu không được trùng với username hoặc email');

        // referral code invalid length / chars
        await expect(
          registerSchema.validate({
            displayName: 'A',
            username: 'validuser',
            email: 'test@example.com',
            password: 'validPassword123',
            referralCode: '1234',
          }),
        ).rejects.toThrow('Mã giới thiệu phải gồm 8 ký tự hợp lệ');
      });

      it('TC-003: registerFormSchema should reject when confirmPassword does not match password', async () => {
        const invalidForm = {
          displayName: 'Nguyễn Văn A',
          username: 'nguyenvana',
          email: 'nguyenvana@example.com',
          password: 'MatKhau123',
          confirmPassword: 'MatKhauKhac',
        };
        await expect(registerFormSchema.validate(invalidForm)).rejects.toThrow(
          'Mật khẩu xác nhận không khớp',
        );

        const validForm = {
          displayName: 'Nguyễn Văn A',
          username: 'nguyenvana',
          email: 'nguyenvana@example.com',
          password: 'MatKhau123',
          confirmPassword: 'MatKhau123',
        };
        await expect(registerFormSchema.validate(validForm)).resolves.toMatchObject({
          password: 'MatKhau123',
          confirmPassword: 'MatKhau123',
        });
      });
    });


    describe('loginSchema', () => {
      it('should validate valid login input', async () => {
        await expect(
          loginSchema.validate({ login: 'nguyenvana', password: 'secretpassword' }),
        ).resolves.toBeTruthy();
      });

      it('should reject empty login or password', async () => {
        await expect(loginSchema.validate({ login: '', password: '' })).rejects.toThrow();
      });
    });

    describe('forgotPasswordSchema', () => {
      it('should validate valid email', async () => {
        await expect(
          forgotPasswordSchema.validate({ email: 'user@example.com' }),
        ).resolves.toBeTruthy();
      });

      it('should reject invalid email', async () => {
        await expect(
          forgotPasswordSchema.validate({ email: 'invalid-email' }),
        ).rejects.toThrow();
      });
    });

    describe('resetPasswordSchema', () => {
      it('should validate valid reset token and password', async () => {
        await expect(
          resetPasswordSchema.validate({
            token: 'valid-base64-token-string-value-here-12345',
            newPassword: 'new-strong-password',
          }),
        ).resolves.toBeTruthy();
      });

      it('should reject too short password', async () => {
        await expect(
          resetPasswordSchema.validate({
            token: 'valid-token',
            newPassword: 'short',
          }),
        ).rejects.toThrow();
      });
    });

    describe('enterReferralSchema', () => {
      it('should validate valid 8-char uppercase code (excluding 0, O, 1, I, L)', async () => {
        await expect(
          enterReferralSchema.validate({ code: 'k7qx4mzp' }),
        ).resolves.toMatchObject({ code: 'K7QX4MZP' });
      });

      it('should reject code with ambiguous characters (e.g. 0, O, 1, I, L)', async () => {
        await expect(enterReferralSchema.validate({ code: 'A0B1C2D3' })).rejects.toThrow();
      });
    });

    describe('palmResultSchema', () => {
      it('should validate successful PalmResult', async () => {
        const result = {
          isPalm: true,
          rejectReason: null,
          school: ReadingSchool.EASTERN,
          hand: HandOrientation.LEFT,
          imageQuality: ImageQuality.GOOD,
          topics: ['nguHanh', 'thienVan', 'love'],
          sections: [
            {
              key: 'nguHanh',
              title: 'Dáng tay ngũ hành',
              observation: 'Lòng bàn tay vuông',
              meaning: 'Tay Thổ: thực tế',
            },
            {
              key: 'thienVan',
              title: 'Thiên văn',
              observation: 'Đường dài và rõ nét',
              meaning: 'Tình cảm sâu sắc',
            },
          ],
          aspects: {
            love: 'Tình cảm hoà thuận',
          },
          summary: 'Dáng tay Thổ biểu thị tính cách điềm đạm.',
          advice: 'Hãy kiên nhẫn phát huy thế mạnh.',
          disclaimer: 'Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.',
        };
        await expect(palmResultSchema.validate(result)).resolves.toBeTruthy();
      });

      it('should validate rejected palm result when isPalm is false', async () => {
        const rejected = {
          isPalm: false,
          rejectReason: 'Không nhìn rõ lòng bàn tay.',
          school: null,
          hand: null,
          imageQuality: null,
          topics: null,
          sections: null,
          aspects: null,
          summary: null,
          advice: null,
          disclaimer: null,
        };
        await expect(palmResultSchema.validate(rejected)).resolves.toBeTruthy();
      });
    });
  });
});
