import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { GuestTrial, GuestTrialDocument } from '../../schemas/guest-trial.schema';

@Injectable()
export class GuestTrialRateLimitGuard implements CanActivate {
  constructor(
    @InjectModel(GuestTrial.name)
    private readonly guestTrialModel: Model<GuestTrialDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const rawIp =
      (req.headers['x-forwarded-for'] as string) ||
      req.ip ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const clientIp = rawIp.split(',')[0].trim();
    const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');

    req.clientIp = clientIp;
    req.ipHash = ipHash;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await this.guestTrialModel.countDocuments({
      ipHash,
      createdAt: { $gte: twentyFourHoursAgo },
    });

    if (count >= 5) {
      throw new HttpException(
        {
          code: 'IP_TRIAL_LIMIT_EXCEEDED',
          message:
            'Địa chỉ mạng của bạn đã đạt giới hạn 5 lượt bói thử trong ngày. Vui lòng đăng ký tài khoản để tiếp tục!',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
