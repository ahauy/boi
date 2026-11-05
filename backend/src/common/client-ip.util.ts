import * as crypto from 'crypto';
import { BlockList, isIP } from 'net';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const INTERNAL_RANGES = new BlockList();
INTERNAL_RANGES.addSubnet('10.0.0.0', 8, 'ipv4');
INTERNAL_RANGES.addSubnet('100.64.0.0', 10, 'ipv4');
INTERNAL_RANGES.addSubnet('127.0.0.0', 8, 'ipv4');
INTERNAL_RANGES.addSubnet('169.254.0.0', 16, 'ipv4');
INTERNAL_RANGES.addSubnet('172.16.0.0', 12, 'ipv4');
INTERNAL_RANGES.addSubnet('192.168.0.0', 16, 'ipv4');
INTERNAL_RANGES.addAddress('::1', 'ipv6');
INTERNAL_RANGES.addSubnet('fc00::', 7, 'ipv6');
INTERNAL_RANGES.addSubnet('fe80::', 10, 'ipv6');

/**
 * Hash IP bằng HMAC với khoá bí mật của máy chủ (cùng IDENTITY_HASH_SECRET với hash thiết bị).
 * SHA-256 trần không đủ: IPv4 chỉ có 2^32 giá trị nên dò ngược được. Tiền tố `ip:` tách miền với
 * hash thiết bị để hai loại hash không bao giờ trùng nhau.
 */
export function hashIp(secret: string, value: string): string {
  return crypto.createHmac('sha256', secret).update(`ip:${value}`).digest('hex');
}

/**
 * IP công khai của client, hoặc null khi không xác định được.
 * Sau proxy, `CLIENT_IP_HEADER` phải là header mà hạ tầng đảm bảo mục đầu là IP thật, nếu không
 * client tự giả được. IP nội bộ trả về null để không gộp mọi người vào một mạng.
 */
export function resolveClientIp(
  req: Request,
  configService: ConfigService,
): string | null {
  const headerName = configService.get<string>('CLIENT_IP_HEADER')?.trim();
  const headerValue = headerName
    ? req.headers[headerName.toLowerCase()]
    : undefined;
  const raw = headerName
    ? (Array.isArray(headerValue) ? headerValue[0] : headerValue)
    : req.socket?.remoteAddress;

  const ip = raw?.split(',')[0].trim().toLowerCase().replace(/^::ffff:/, '');
  if (!ip) return null;

  const family = isIP(ip);
  if (family === 0) return null;
  return INTERNAL_RANGES.check(ip, family === 4 ? 'ipv4' : 'ipv6') ? null : ip;
}
