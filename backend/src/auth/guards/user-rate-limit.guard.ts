import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { AuthenticatedRequest } from './jwt-auth.guard';

interface UserRateLimitOptions {
  limit: number;
  windowMs: number;
}

const USER_RATE_LIMIT = 'userRateLimit';

// Per-user limit for authenticated endpoints (api-contract.md "Rate limit"); place after JwtAuthGuard
export const UserRateLimit = (options: UserRateLimitOptions) => SetMetadata(USER_RATE_LIMIT, options);

@Injectable()
export class UserRateLimitGuard implements CanActivate {
  // ponytail: in-memory per process, like AuthRateLimitGuard; move to Redis when running several instances
  private readonly requests = new Map<string, { timestamps: number[]; windowMs: number }>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<UserRateLimitOptions>(USER_RATE_LIMIT, context.getHandler());
    if (!options) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const now = Date.now();
    const key = `${context.getClass().name}.${context.getHandler().name}:${req.user._id.toString()}`;

    this.prune(now);
    const timestamps = this.requests.get(key)?.timestamps ?? [];

    if (timestamps.length >= options.limit) {
      const retryAfterSeconds = Math.ceil((timestamps[0] + options.windowMs - now) / 1000);
      http.getResponse<Response>().setHeader('Retry-After', Math.max(retryAfterSeconds, 1));
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
    this.requests.set(key, { timestamps, windowMs: options.windowMs });
    return true;
  }

  // Each entry keeps its own window, since routes may use different limits
  private prune(now: number): void {
    for (const [key, entry] of this.requests) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < entry.windowMs);
      if (!entry.timestamps.length) this.requests.delete(key);
    }
  }
}
