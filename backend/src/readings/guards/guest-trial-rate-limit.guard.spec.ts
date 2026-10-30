import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { GuestTrialRateLimitGuard } from './guest-trial-rate-limit.guard';
import * as crypto from 'crypto';

describe('GuestTrialRateLimitGuard (TC-019)', () => {
  let guard: GuestTrialRateLimitGuard;
  let mockGuestTrialModel: any;

  beforeEach(() => {
    mockGuestTrialModel = {
      countDocuments: vi.fn(),
    };
    guard = new GuestTrialRateLimitGuard(mockGuestTrialModel as any);
  });

  function createMockContext(ip: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-forwarded-for': ip },
          socket: { remoteAddress: ip },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows request when IP has fewer than 5 trials in 24 hours', async () => {
    mockGuestTrialModel.countDocuments.mockResolvedValue(4);
    const context = createMockContext('1.2.3.4');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('throws 429 IP_TRIAL_LIMIT_EXCEEDED when IP has 5 or more trials in 24 hours', async () => {
    mockGuestTrialModel.countDocuments.mockResolvedValue(5);
    const ip = '1.2.3.4';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const context = createMockContext(ip);

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    try {
      await guard.canActivate(context);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(err.getResponse()).toEqual({
        code: 'IP_TRIAL_LIMIT_EXCEEDED',
        message: 'Địa chỉ mạng của bạn đã đạt giới hạn 5 lượt bói thử trong ngày. Vui lòng đăng ký tài khoản để tiếp tục!',
      });
    }

    expect(mockGuestTrialModel.countDocuments).toHaveBeenCalledWith({
      ipHash,
      createdAt: { $gte: expect.any(Date) },
    });
  });
});
