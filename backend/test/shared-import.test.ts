import { describe, it, expect } from 'vitest';
import {
  ReadingSchool,
  LifeAspect,
  ReadingStatus,
  CreditTransactionType,
  ImageQuality,
  HandOrientation,
  READING_SCHOOLS,
  CREDIT_AMOUNTS,
  registerSchema,
} from '@palmsight/shared';

describe('Backend @palmsight/shared import test', () => {
  it('should import enums properly', () => {
    expect(ReadingSchool.WESTERN).toBe('WESTERN');
    expect(LifeAspect.PERSONALITY).toBe('personality');
    expect(ReadingStatus.DONE).toBe('DONE');
    expect(CreditTransactionType.READING_SPEND).toBe('READING_SPEND');
    expect(ImageQuality.GOOD).toBe('GOOD');
    expect(HandOrientation.LEFT).toBe('LEFT');
  });

  it('should import constants properly', () => {
    expect(CREDIT_AMOUNTS.SIGNUP_BONUS).toBe(3);
    expect(READING_SCHOOLS[ReadingSchool.EASTERN].name).toBe('Chỉ tay phương Đông');
  });

  it('should import and execute yup schema', async () => {
    await expect(
      registerSchema.validate({
        displayName: 'Test',
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      }),
    ).resolves.toBeTruthy();
  });
});
