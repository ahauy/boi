import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { isValidObjectId, Model } from 'mongoose';
import type { Request } from 'express';
import { User, UserDocument } from '../../schemas/user.schema';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export interface AuthenticatedRequest extends Request {
  user: UserDocument;
  sessionId: string;
}

export const unauthenticated = () =>
  new UnauthorizedException({
    code: 'UNAUTHENTICATED',
    message: 'Bạn cần đăng nhập để tiếp tục.',
  });

// Verifies the access token AND that the user still exists and is not deleted (api-contract.md "Xác thực")
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthenticated();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          message: 'Phiên đăng nhập đã hết hạn.',
        });
      }
      throw unauthenticated();
    }

    if (!isValidObjectId(payload.sub) || !payload.sid) throw unauthenticated();

    const user = await this.userModel.findOne({ _id: payload.sub, deletedAt: null });
    if (!user) throw unauthenticated();

    req.user = user;
    req.sessionId = payload.sid;
    return true;
  }
}
