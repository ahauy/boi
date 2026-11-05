import { describe, it, expect } from 'vitest';
import { updateProfileSchema } from './index';

const validate = (value: unknown) => updateProfileSchema.validate(value, { abortEarly: false });

describe('updateProfileSchema', () => {
  it('trim và thu gọn khoảng trắng liên tiếp', async () => {
    expect((await validate({ displayName: '  Nguyễn   Văn   A  ' })).displayName).toBe('Nguyễn Văn A');
  });

  it('nhận đúng 1 và 50 ký tự, từ chối 0 và 51', async () => {
    await expect(validate({ displayName: 'a' })).resolves.toBeTruthy();
    await expect(validate({ displayName: 'a'.repeat(50) })).resolves.toBeTruthy();
    await expect(validate({ displayName: '' })).rejects.toThrow();
    await expect(validate({ displayName: 'a'.repeat(51) })).rejects.toThrow();
  });

  it('từ chối thiếu trường, chuỗi chỉ khoảng trắng, kiểu không phải chuỗi dạng null', async () => {
    await expect(validate({})).rejects.toThrow();
    await expect(validate({ displayName: '    　 ' })).rejects.toThrow();
    await expect(validate({ displayName: null })).rejects.toThrow();
    await expect(validate({ displayName: 123 })).rejects.toThrow();
  });

  it.each([
    ['NUL', 'a\u0000b'],
    ['tab', 'a\tb'],
    ['xuống dòng ở cuối', 'ab\n'],
    ['DEL', 'a\u007fb'],
    ['C1', 'a\u0085b'],
    ['zero-width space', 'a​b'],
    ['RLM', 'a‏b'],
    ['RLO', 'a‮b'],
    ['isolate', 'a⁦b'],
    ['BOM', 'a﻿b'],
  ])('từ chối ký tự ẩn: %s', async (_name, displayName) => {
    await expect(validate({ displayName })).rejects.toThrow();
  });

  it('từ chối trường lạ', async () => {
    await expect(validate({ displayName: 'An', username: 'hacker' })).rejects.toThrow();
    await expect(validate({ displayName: 'An', id: 'x' })).rejects.toThrow();
  });
});
