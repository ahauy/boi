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

const IP_WINDOW_MS = 60_000;
const IP_LIMIT = 10;

/** Giới hạn theo IP cho `/auth/refresh`: 10 lần/phút. */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly ipRequests = new Map<string, RateLimitRecord>();

  get ipRecordCount(): number {
    return this.ipRequests.size;
  }

  prune(now = Date.now()): void {
    for (const [key, record] of this.ipRequests.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < IP_WINDOW_MS);
      if (record.timestamps.length === 0) {
        this.ipRequests.delete(key);
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

    // Dọn bản ghi cũ để map không phình mãi
    this.prune(now);

    const ipRecord = this.ipRequests.get(clientIp) || { timestamps: [] };

    if (ipRecord.timestamps.length >= IP_LIMIT) {
      res.setHeader('Retry-After', 60);
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    ipRecord.timestamps.push(now);
    this.ipRequests.set(clientIp, ipRecord);

    return true;
  }
}
