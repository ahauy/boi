import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  // IP window: 1 minute (60,000ms), max 10 requests
  private readonly ipRequests = new Map<string, RateLimitRecord>();
  // Email window: 1 hour (3,600,000ms), max 3 emails
  private readonly emailRequests = new Map<string, RateLimitRecord>();

  get ipRecordCount(): number {
    return this.ipRequests.size;
  }

  get emailRecordCount(): number {
    return this.emailRequests.size;
  }

  prune(now = Date.now()): void {
    this.pruneMap(this.ipRequests, 60_000, now);
    this.pruneMap(this.emailRequests, 3_600_000, now);
  }

  private pruneMap(map: Map<string, RateLimitRecord>, windowMs: number, now: number): void {
    for (const [key, record] of map.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
      if (record.timestamps.length === 0) {
        map.delete(key);
      }
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const clientIp = ip.split(',')[0].trim();
    const now = Date.now();

    // Prune stale records from rate limit maps to prevent memory leak
    this.prune(now);

    // 1. Check IP rate limit (10 req/min)
    const ipRecord = this.ipRequests.get(clientIp) || { timestamps: [] };

    if (ipRecord.timestamps.length >= 10) {
      res.setHeader('Retry-After', 60);
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Check Email rate limit (3 emails/hour) for register, resend-verification or forgot-password
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
    if (email) {
      const emailRecord = this.emailRequests.get(email) || { timestamps: [] };

      if (emailRecord.timestamps.length >= 3) {
        if (req.path.includes('/register')) {
          res.setHeader('Retry-After', 3600);
          throw new HttpException(
            {
              code: 'RATE_LIMITED',
              message: 'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        } else if (req.path.includes('/resend-verification') || req.path.includes('/forgot-password')) {
          // Anti-enumeration / silent bypass: set flag to skip email dispatch, but allow 202
          (req as unknown as { skipEmailDispatch?: boolean }).skipEmailDispatch = true;
          return true;
        }
      }

      emailRecord.timestamps.push(now);
      this.emailRequests.set(email, emailRecord);
    }

    ipRecord.timestamps.push(now);
    this.ipRequests.set(clientIp, ipRecord);

    return true;
  }
}
