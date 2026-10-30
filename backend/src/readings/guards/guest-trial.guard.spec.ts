import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { GuestTrialGuard } from './guest-trial.guard';
import * as crypto from 'crypto';

describe('GuestTrialGuard (TC-004, TC-005, TC-006, TC-007)', () => {
  let guard: GuestTrialGuard;
  let mockGuestTrialModel: any;

  beforeEach(() => {
    mockGuestTrialModel = {
      findOne: vi.fn(),
    };
    guard = new GuestTrialGuard(mockGuestTrialModel as any);
  });

  function createMockContext(request: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('TC-004: Throws 403 GUEST_TRIAL_LIMIT_REACHED if signed cookie ps_guest_trial is present', async () => {
    const request = {
      signedCookies: { ps_guest_trial: 'some-signed-token' },
      body: { fingerprint: 'fingerprint-1234567890' },
    };
    const context = createMockContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    try {
      await guard.canActivate(context);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'GUEST_TRIAL_LIMIT_REACHED',
        message: 'Bạn đã sử dụng hết 1 lượt bói thử miễn phí. Hãy đăng ký tài khoản để tiếp tục trải nghiệm!',
      });
    }
    expect(mockGuestTrialModel.findOne).not.toHaveBeenCalled();
  });

  it('TC-005: Throws 403 GUEST_TRIAL_LIMIT_REACHED if fingerprint exists in guest_trials', async () => {
    const fp = 'fp_incognito_device_1234567890';
    const fpHash = crypto.createHash('sha256').update(fp).digest('hex');

    mockGuestTrialModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ _id: 'trial-id', fingerprintHash: fpHash }),
    });

    const request = {
      signedCookies: {},
      cookies: {},
      body: { fingerprint: fp },
    };
    const context = createMockContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(mockGuestTrialModel.findOne).toHaveBeenCalledWith({ fingerprintHash: fpHash });
  });

  it('TC-006: Throws 400 VALIDATION_ERROR if fingerprint is missing or < 16 chars', async () => {
    const requestMissing = {
      signedCookies: {},
      body: {},
    };
    const contextMissing = createMockContext(requestMissing);

    await expect(guard.canActivate(contextMissing)).rejects.toThrow(BadRequestException);

    const requestShort = {
      signedCookies: {},
      body: { fingerprint: 'short_fp' },
    };
    const contextShort = createMockContext(requestShort);

    await expect(guard.canActivate(contextShort)).rejects.toThrow(BadRequestException);
  });

  it('TC-007: Returns true and sets fingerprintHash on request if no cookie and fingerprint is not in database', async () => {
    const fp = 'valid_device_fingerprint_unique_999';
    const fpHash = crypto.createHash('sha256').update(fp).digest('hex');

    mockGuestTrialModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });

    const request: any = {
      signedCookies: {},
      cookies: {},
      body: { fingerprint: fp },
    };
    const context = createMockContext(request);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.fingerprintHash).toBe(fpHash);
    expect(mockGuestTrialModel.findOne).toHaveBeenCalledWith({ fingerprintHash: fpHash });
  });

  it('TC-004b: An unsigned/tampered cookie in cookies.ps_guest_trial is ignored and falls back to fingerprint check', async () => {
    const fp = 'valid_device_fingerprint_unique_888';
    const fpHash = crypto.createHash('sha256').update(fp).digest('hex');

    mockGuestTrialModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });

    const request: any = {
      signedCookies: {},
      cookies: { ps_guest_trial: 'tampered-unsigned-token' },
      body: { fingerprint: fp },
    };
    const context = createMockContext(request);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.fingerprintHash).toBe(fpHash);
    expect(mockGuestTrialModel.findOne).toHaveBeenCalledWith({ fingerprintHash: fpHash });
  });
});
