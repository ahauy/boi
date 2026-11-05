import * as crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { computeDeviceIdHash } from './device-id-hash.util';
import { hashIp } from './client-ip.util';

describe('hashIp (HMAC)', () => {
  const secret = 'test-identity-secret-at-least-32-chars-long';

  it('là HMAC-SHA256 có khoá, không phải SHA-256 trần của IP', () => {
    const plain = crypto.createHash('sha256').update('203.0.113.10').digest('hex');
    expect(hashIp(secret, '203.0.113.10')).not.toBe(plain);
    expect(hashIp(secret, '203.0.113.10')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('đúng công thức HMAC-SHA256(secret, "ip:" + IP)', () => {
    const expected = crypto.createHmac('sha256', secret).update('ip:203.0.113.10').digest('hex');
    expect(hashIp(secret, '203.0.113.10')).toBe(expected);
  });

  it('ổn định với cùng khoá và IP, khác nhau theo IP và theo khoá', () => {
    expect(hashIp(secret, '203.0.113.10')).toBe(hashIp(secret, '203.0.113.10'));
    expect(hashIp(secret, '203.0.113.10')).not.toBe(hashIp(secret, '203.0.113.11'));
    expect(hashIp(secret, '203.0.113.10')).not.toBe(hashIp('another-secret-another-secret-123456', '203.0.113.10'));
  });

  it('không dò ngược được bằng bảng SHA-256 của IPv4', () => {
    // Kẻ có DB nhưng không có khoá không tính lại được hash từ một IP đoán.
    const guess = crypto.createHash('sha256').update('203.0.113.10').digest('hex');
    expect(hashIp(secret, '203.0.113.10')).not.toBe(guess);
  });

  it('tách miền với hash thiết bị: cùng chuỗi vào vẫn ra hash khác', () => {
    expect(hashIp(secret, 'abc')).not.toBe(computeDeviceIdHash(secret, 'abc'));
  });
});
