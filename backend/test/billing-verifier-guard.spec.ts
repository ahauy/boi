import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PlayPurchaseVerifier } from '../src/billing/play-purchase.verifier';

const verifierWith = (values: Record<string, string>) =>
  new PlayPurchaseVerifier({
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as unknown as ConfigService);

describe('PlayPurchaseVerifier fails closed', () => {
  it.each([
    ['production', { NODE_ENV: 'production' }],
    ['development', { NODE_ENV: 'development' }],
    ['an unset NODE_ENV', {}],
  ])('refuses purchases in %s without a service account', async (_label, env) => {
    await expect(
      verifierWith(env).verify({
        productId: 'weeklyid',
        purchaseToken: 'any-token',
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
});
