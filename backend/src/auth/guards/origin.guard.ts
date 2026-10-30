import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// Cookie-authenticated endpoints (/auth/refresh, /auth/logout) only accept requests sent by our own SPA,
// plus native app requests that authenticate with the x-refresh-token header instead of cookies
// (browsers always send Origin on cross-origin POST, so a cookie-CSRF cannot bypass this)
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;
    if (!origin && request.headers["x-refresh-token"]) {
      return true;
    }
    const allowedOrigin = this.configService
      .get<string>('PUBLIC_BASE_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');

    if (origin !== allowedOrigin) {
      throw new ForbiddenException({
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'Yêu cầu không được phép từ nguồn này.',
      });
    }
    return true;
  }
}
