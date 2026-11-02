import { randomUUID } from 'expo-crypto';

/** Backend yêu cầu `Idempotency-Key` là UUID v4 cho POST /readings. */
export function newIdempotencyKey(): string {
  return randomUUID();
}
