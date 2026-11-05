import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService Unit Logic (TC-006)', () => {
  let authService: AuthService;

  beforeEach(() => {
    const configService = {
      get: vi.fn((key: string, def?: unknown) => {
        const map: Record<string, unknown> = {
          JWT_ACCESS_TTL_SECONDS: 900,
          REFRESH_TOKEN_TTL_DAYS: 30,
          IDENTITY_HASH_SECRET: 'test-identity-secret-minimum-32-chars',
        };
        return map[key] ?? def;
      }),
    } as unknown as ConfigService;

    const mockExistsQuery = () => {
      const q: any = Promise.resolve(false);
      q.session = vi.fn().mockReturnValue(q);
      return q;
    };
    const userModel = { exists: vi.fn().mockImplementation(mockExistsQuery) };

    authService = new AuthService(
      userModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as unknown as CreditLedgerService,
      new JwtService({ secret: 'test-jwt-access-secret-minimum-32-chars-long' }),
      configService,
      {} as any,
    );
  });

  describe('TC-006: generateReferralCode', () => {
    it('should generate 8 uppercase characters excluding ambiguous chars (0, O, 1, I, L)', async () => {
      for (let i = 0; i < 50; i++) {
        const code = await authService.generateReferralCode();

        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);

        expect(code).not.toContain('0');
        expect(code).not.toContain('O');
        expect(code).not.toContain('1');
        expect(code).not.toContain('I');
        expect(code).not.toContain('L');
      }
    });
  });
});
