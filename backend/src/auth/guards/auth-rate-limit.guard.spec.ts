import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

describe('AuthRateLimitGuard', () => {
  let guard: AuthRateLimitGuard;

  const createMockContext = (ip = '192.168.1.1', email?: string, path = '/api/v1/auth/register') => {
    const resHeaders: Record<string, unknown> = {};
    const req = {
      headers: { 'x-forwarded-for': ip },
      socket: { remoteAddress: ip },
      body: email ? { email } : {},
      path,
    };
    const res = {
      setHeader: vi.fn((key: string, val: unknown) => {
        resHeaders[key] = val;
      }),
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    return { context, req, res, resHeaders };
  };

  beforeEach(() => {
    guard = new AuthRateLimitGuard();
  });

  it('should allow requests within rate limits', () => {
    const { context } = createMockContext('1.2.3.4', 'user@example.com');
    const result = guard.canActivate(context);
    expect(result).toBe(true);
    expect(guard.ipRecordCount).toBe(1);
    expect(guard.emailRecordCount).toBe(1);
  });

  it('should enforce IP rate limit at 10 requests per minute', () => {
    const ip = '10.0.0.1';
    for (let i = 0; i < 10; i++) {
      const { context } = createMockContext(ip);
      expect(guard.canActivate(context)).toBe(true);
    }

    const { context, res } = createMockContext(ip);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 60);

    try {
      guard.canActivate(context);
    } catch (err) {
      const httpErr = err as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(httpErr.getResponse()).toEqual({
        code: 'RATE_LIMITED',
        message: 'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.',
      });
    }
  });

  it('should enforce Email rate limit at 3 requests per hour for /register', () => {
    const email = 'limit@example.com';
    for (let i = 0; i < 3; i++) {
      const { context } = createMockContext(`10.0.0.${i}`, email, '/api/v1/auth/register');
      expect(guard.canActivate(context)).toBe(true);
    }

    const { context, res } = createMockContext('10.0.0.99', email, '/api/v1/auth/register');
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 3600);
  });

  it('should set skipEmailDispatch = true for /resend-verification after 3 requests without throwing', () => {
    const email = 'resend@example.com';
    for (let i = 0; i < 3; i++) {
      const { context } = createMockContext(`10.0.0.${i}`, email, '/api/v1/auth/resend-verification');
      expect(guard.canActivate(context)).toBe(true);
    }

    const { context, req } = createMockContext('10.0.0.99', email, '/api/v1/auth/resend-verification');
    const result = guard.canActivate(context);
    expect(result).toBe(true);
    expect((req as unknown as { skipEmailDispatch?: boolean }).skipEmailDispatch).toBe(true);
  });

  it('should prune expired records from memory map', () => {
    const now = Date.now();
    const { context: ctx1 } = createMockContext('1.1.1.1', 'old@example.com');
    guard.canActivate(ctx1);
    expect(guard.ipRecordCount).toBe(1);
    expect(guard.emailRecordCount).toBe(1);

    // Advance time past IP window (61s) but before email window (1h)
    guard.prune(now + 65_000);
    expect(guard.ipRecordCount).toBe(0);
    expect(guard.emailRecordCount).toBe(1);

    // Advance time past email window (3601s)
    guard.prune(now + 3_601_000);
    expect(guard.emailRecordCount).toBe(0);
  });
});
