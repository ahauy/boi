import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { GuestTrial, GuestTrialDocument } from '../../schemas/guest-trial.schema';
import { Reading, ReadingDocument } from '../../schemas/reading.schema';

@Injectable()
export class GuestTrialGuard implements CanActivate {
  constructor(
    @InjectModel(GuestTrial.name)
    private readonly guestTrialModel: Model<GuestTrialDocument>,
    @Optional()
    @InjectModel(Reading.name)
    private readonly readingModel?: Model<ReadingDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 0. Idempotency replay check: allow requests that match an existing guest reading to reach controller/service
    const rawIdempotency =
      request.headers?.['idempotency-key'] || request.headers?.['idempotencykey'];
    const idempotencyKey =
      typeof rawIdempotency === 'string' && rawIdempotency.trim()
        ? rawIdempotency.trim()
        : null;

    if (idempotencyKey && this.readingModel) {
      const existing = await this.readingModel.findOne({
        idempotencyKey,
        isGuest: true,
      });
      if (existing) {
        return true;
      }
    }

    // 1. Check signed cookie 'ps_guest_trial'
    const cookie =
      typeof request.signedCookies?.ps_guest_trial === 'string'
        ? request.signedCookies.ps_guest_trial
        : null;
    if (cookie) {
      throw new ForbiddenException({
        code: 'GUEST_TRIAL_LIMIT_REACHED',
        message:
          'Bạn đã sử dụng hết 1 lượt bói thử miễn phí. Hãy đăng ký tài khoản để tiếp tục trải nghiệm!',
      });
    }

    // 2. Validate client fingerprint
    const rawFp =
      request.body?.fingerprint ||
      request.headers?.['x-fingerprint'] ||
      request.headers?.['x-client-fingerprint'];
    const fingerprint = typeof rawFp === 'string' ? rawFp.trim() : '';
    if (!fingerprint || fingerprint.length < 16) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu yêu cầu không hợp lệ.',
        details: {
          fields: [
            { field: 'fingerprint', message: 'Thiếu thông tin nhận diện thiết bị.' },
          ],
        },
      });
    }

    // 3. Hash SHA-256 fingerprint
    const fingerprintHash = crypto
      .createHash('sha256')
      .update(fingerprint.trim())
      .digest('hex');

    // 4. Check if fingerprint exists in guest_trials
    const existingTrial = await this.guestTrialModel.findOne({ fingerprintHash }).exec();
    if (existingTrial) {
      throw new ForbiddenException({
        code: 'GUEST_TRIAL_LIMIT_REACHED',
        message:
          'Bạn đã sử dụng hết 1 lượt bói thử miễn phí. Hãy đăng ký tài khoản để tiếp tục trải nghiệm!',
      });
    }

    // Attach computed hash to request for subsequent processing
    request.fingerprintHash = fingerprintHash;

    return true;
  }
}
