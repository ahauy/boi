import 'reflect-metadata';
import * as crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PlayPurchaseVerifier } from '../src/billing/play-purchase.verifier';

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const NOW = new Date('2026-11-04T00:00:00.000Z');
const FUTURE = '2026-12-04T00:00:00.000Z';

const verifier = () =>
  new PlayPurchaseVerifier({
    get: (key: string, fallback?: unknown) =>
      ({
        NODE_ENV: 'production',
        GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({
          client_email: 'billing@example.iam.gserviceaccount.com',
          private_key: privateKey,
        }),
      })[key] ?? fallback,
  } as unknown as ConfigService);

const lineItem = (extra: object = {}) => ({
  productId: 'weeklyid',
  expiryTime: FUTURE,
  autoRenewingPlan: {
    autoRenewEnabled: true,
    recurringPrice: { currencyCode: 'EUR', units: '6', nanos: 490000000 },
  },
  offerPhase: { basePrice: {} },
  ...extra,
});

const subscription = (extra: object = {}) => ({
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
  lineItems: [lineItem()],
  ...extra,
});

function stubGoogle(lookup: Response, ack: Response = new Response('{}')) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('oauth2')) {
      return new Response(JSON.stringify({ access_token: 'token' }));
    }
    return url.endsWith(':acknowledge') ? ack : lookup;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const verifyWith = (body: object, hints: object = {}) => {
  const fetchMock = stubGoogle(new Response(JSON.stringify(body)));
  return verifier()
    .verify({
      productId: 'weeklyid',
      purchaseToken: 'token-1',
      now: NOW,
      ...hints,
    })
    .then((verified) => ({ verified, fetchMock }));
};

describe('PlayPurchaseVerifier against subscriptionsv2', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('trial and price come from Google, not from the client', () => {
    it('reports a trial even when the client sends a paid hint', async () => {
      const { verified } = await verifyWith(
        subscription({ lineItems: [lineItem({ offerPhase: { freeTrial: {} } })] }),
        { isTrial: false, priceAmountMicros: 6_990_000 },
      );

      expect(verified.isTrial).toBe(true);
      expect(verified.priceAmountMicros).toBe(0);
    });

    it('reports the paid phase even when the offer is named trial and the client says trial', async () => {
      const { verified } = await verifyWith(
        subscription({
          lineItems: [
            lineItem({
              offerDetails: { offerId: 'free-trial', offerTags: ['trial'] },
            }),
          ],
        }),
        { isTrial: true, priceAmountMicros: 0 },
      );

      expect(verified.isTrial).toBe(false);
      expect(verified.priceAmountMicros).toBe(6_490_000);
      expect(verified.priceCurrencyCode).toBe('EUR');
    });

    it('does not treat a missing phase as paid', async () => {
      const { verified } = await verifyWith(
        subscription({ lineItems: [lineItem({ offerPhase: undefined })] }),
        { priceAmountMicros: 6_990_000 },
      );

      expect(verified.isTrial).toBe(true);
    });
  });

  describe('subscriptionState decides access', () => {
    it.each([
      'SUBSCRIPTION_STATE_ACTIVE',
      'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
      'SUBSCRIPTION_STATE_CANCELED',
    ])('keeps the expiry for %s', async (subscriptionState) => {
      const { verified } = await verifyWith(subscription({ subscriptionState }));

      expect(verified.expiresAt.toISOString()).toBe(FUTURE);
    });

    it.each([
      'SUBSCRIPTION_STATE_PENDING',
      'SUBSCRIPTION_STATE_EXPIRED',
      'SUBSCRIPTION_STATE_ON_HOLD',
      'SUBSCRIPTION_STATE_PAUSED',
      'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED',
      'SUBSCRIPTION_STATE_UNSPECIFIED',
      undefined,
    ])('ends access for %s despite a future expiry', async (subscriptionState) => {
      const { verified } = await verifyWith(subscription({ subscriptionState }));

      expect(verified.expiresAt.getTime()).toBeLessThan(NOW.getTime());
      expect(verified.willRenew).toBe(false);
    });

    it('accepts a pending purchase with no expiry, without VIP', async () => {
      const { verified } = await verifyWith(
        subscription({
          subscriptionState: 'SUBSCRIPTION_STATE_PENDING',
          lineItems: [lineItem({ expiryTime: undefined })],
        }),
      );

      expect(verified.expiresAt.getTime()).toBeLessThan(NOW.getTime());
    });

    it('does not acknowledge a purchase that gives no access', async () => {
      const { fetchMock } = await verifyWith(
        subscription({
          subscriptionState: 'SUBSCRIPTION_STATE_PENDING',
          acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
        }),
      );

      expect(fetchMock.mock.calls.some(([url]) => url.endsWith(':acknowledge'))).toBe(false);
    });
  });

  describe('lookup failures', () => {
    it.each([401, 403, 429, 500, 503])(
      'answers 503 for status %i, so nothing is lost',
      async (status) => {
        stubGoogle(new Response('{}', { status }));

        await expect(
          verifier().verify({ productId: 'weeklyid', purchaseToken: 't' }),
        ).rejects.toMatchObject({ status: 503 });
      },
    );

    it.each([400, 404, 410])('treats status %i as an invalid token', async (status) => {
      stubGoogle(new Response('{}', { status }));

      await expect(
        verifier().verify({ productId: 'weeklyid', purchaseToken: 't' }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('acknowledgement', () => {
    it('reports a rejected acknowledgement instead of claiming success', async () => {
      stubGoogle(
        new Response(
          JSON.stringify(
            subscription({ acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING' }),
          ),
        ),
        new Response('{}', { status: 500 }),
      );

      const verified = await verifier().verify({
        productId: 'weeklyid',
        purchaseToken: 't',
      });

      expect(verified.acknowledged).toBe(false);
    });
  });
});
