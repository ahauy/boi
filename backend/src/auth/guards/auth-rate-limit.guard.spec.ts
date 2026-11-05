import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

describe('AuthRateLimitGuard', () => {
  let guard: AuthRateLimitGuard;

  const createMockContext = (ip = '192.168.1.1') => {
    const req = {
      headers: { 'x-forwarded-for': ip },
      socket: { remoteAddress: ip },
      body: {},
      path: '/api/v1/auth/refresh',
    };
    const res = { setHeader: vi.fn() };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;

    return { context, req, res };
  };

  beforeEach(() => {
    guard = new AuthRateLimitGuard();
  });

  it('should allow requests within rate limits', () => {
    const { context } = createMockContext('1.2.3.4');
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.ipRecordCount).toBe(1);
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

  it('should limit each IP separately', () => {
    for (let i = 0; i < 10; i++) guard.canActivate(createMockContext('10.0.0.1').context);
    expect(guard.canActivate(createMockContext('10.0.0.2').context)).toBe(true);
  });

  it('should prune expired records from memory map', () => {
    const now = Date.now();
    guard.canActivate(createMockContext('1.1.1.1').context);
    expect(guard.ipRecordCount).toBe(1);

    guard.prune(now + 65_000);
    expect(guard.ipRecordCount).toBe(0);
  });
});
