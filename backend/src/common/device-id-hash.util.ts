import * as crypto from 'crypto';

export const DEFAULT_IDENTITY_HASH_SECRET = 'palmsight-identity-secret';

/** Hash định danh thiết bị dùng chung cho guest, currency và referral. */
export function computeDeviceIdHash(secret: string, rawDeviceId: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`device:${rawDeviceId.trim()}`)
    .digest('hex');
}
