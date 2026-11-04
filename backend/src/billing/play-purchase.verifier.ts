import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export const ALLOWED_SUBSCRIPTION_PRODUCT_IDS = [
  'weeklyid',
  'yearlyid',
  'monthlyid',
] as const;

export type AllowedSubscriptionProductId =
  (typeof ALLOWED_SUBSCRIPTION_PRODUCT_IDS)[number];

export interface PlayPurchaseVerifyInput {
  productId: string;
  purchaseToken: string;
  packageName?: string;
  orderId?: string | null;
  priceAmountMicros?: number | null;
  priceCurrencyCode?: string | null;
  isTrial?: boolean;
  obfuscatedAccountId?: string | null;
  now?: Date;
}

export interface VerifiedPlayPurchase {
  productId: string;
  purchaseToken: string;
  orderId: string | null;
  expiresAt: Date;
  willRenew: boolean;
  isTrial: boolean;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  acknowledged: boolean;
  obfuscatedAccountId?: string | null;
  rawResponse?: Record<string, unknown> | null;
}

export type PlayPurchaseVerifierFn = (
  input: PlayPurchaseVerifyInput,
) => Promise<VerifiedPlayPurchase>;

/**
 * States that entitle the user, per the Play subscription lifecycle docs: CANCELED keeps access
 * until expiryTime, IN_GRACE_PERIOD retains access. ON_HOLD and PAUSED must block access, a
 * revoked subscription reports EXPIRED, and PENDING has not been paid.
 */
const ENTITLED_SUBSCRIPTION_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_CANCELED',
]);

/** 400, 404 and 410 describe the token. Every other failure says nothing about it. */
const INVALID_TOKEN_STATUSES = new Set([400, 404, 410]);

function moneyToMicros(money?: {
  units?: string;
  nanos?: number;
}): number | null {
  if (!money) return null;
  const micros =
    Number(money.units ?? 0) * 1_000_000 +
    Math.round((money.nanos ?? 0) / 1_000);
  return Number.isFinite(micros) ? micros : null;
}

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

@Injectable()
export class PlayPurchaseVerifier {
  private readonly logger = new Logger(PlayPurchaseVerifier.name);
  private customVerifierFn: PlayPurchaseVerifierFn | null = null;

  constructor(private readonly configService: ConfigService) {}

  setVerifier(fn: PlayPurchaseVerifierFn): void {
    this.customVerifierFn = fn;
  }

  resetVerifier(): void {
    this.customVerifierFn = null;
  }

  getAllowedProductIds(): string[] {
    const weekly = this.configService.get<string>('SUB_WEEKLY_ID', 'weeklyid');
    const yearly = this.configService.get<string>('SUB_YEARLY_ID', 'yearlyid');
    const monthly = this.configService.get<string>(
      'SUB_MONTHLY_ID',
      'monthlyid',
    );
    return Array.from(
      new Set([
        ...ALLOWED_SUBSCRIPTION_PRODUCT_IDS,
        weekly,
        yearly,
        monthly,
      ].filter(Boolean)),
    );
  }

  async verify(input: PlayPurchaseVerifyInput): Promise<VerifiedPlayPurchase> {
    const productId = (input.productId || '').trim();
    const purchaseToken = (input.purchaseToken || '').trim();

    if (!productId || !this.getAllowedProductIds().includes(productId)) {
      throw new BadRequestException({
        code: 'invalid_product',
        message: 'Gói đăng ký không hợp lệ.',
      });
    }

    if (!purchaseToken) {
      throw new BadRequestException({
        code: 'invalid_purchase',
        message: 'Mã giao dịch (purchaseToken) không được để trống.',
      });
    }

    if (this.customVerifierFn) {
      return this.customVerifierFn({ ...input, productId, purchaseToken });
    }

    // The deterministic verifier accepts almost any token, so it runs only under
    // an explicit NODE_ENV=test. An unset NODE_ENV must never reach it.
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      return this.verifyDeterministic({ ...input, productId, purchaseToken });
    }

    const serviceAccountJson = this.configService.get<string>(
      'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
      '',
    );

    if (!serviceAccountJson.trim()) {
      this.logger.error(
        'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set; refusing to verify purchases.',
      );
      throw new ServiceUnavailableException({
        code: 'billing_unavailable',
        message: 'Chưa thể xác minh giao dịch. Vui lòng thử lại sau.',
      });
    }

    return this.verifyWithGooglePlayApi({
      ...input,
      productId,
      purchaseToken,
      serviceAccountJson,
    });
  }

  private async verifyDeterministic(
    input: PlayPurchaseVerifyInput,
  ): Promise<VerifiedPlayPurchase> {
    const { productId, purchaseToken } = input;
    const now = input.now ?? new Date();

    if (
      purchaseToken === 'invalid' ||
      purchaseToken.startsWith('invalid_') ||
      purchaseToken.startsWith('fail_')
    ) {
      throw new BadRequestException({
        code: 'invalid_purchase',
        message: 'Giao dịch Google Play không hợp lệ hoặc không tìm thấy.',
      });
    }

    const isTrial = Boolean(
      input.isTrial ||
        purchaseToken.includes(':trial:') ||
        purchaseToken.startsWith('trial_') ||
        purchaseToken.endsWith('_trial') ||
        input.priceAmountMicros === 0,
    );

    const isExpired =
      purchaseToken.includes(':expired:') ||
      purchaseToken.startsWith('expired_') ||
      purchaseToken.endsWith('_expired');

    const isCanceled =
      isExpired ||
      purchaseToken.includes(':canceled:') ||
      purchaseToken.startsWith('canceled_') ||
      purchaseToken.endsWith('_canceled');

    let durationMs: number;
    if (productId === 'weeklyid') {
      durationMs = (isTrial ? 3 : 7) * 24 * 60 * 60 * 1000;
    } else if (productId === 'yearlyid') {
      durationMs = 365 * 24 * 60 * 60 * 1000;
    } else {
      durationMs = 30 * 24 * 60 * 60 * 1000;
    }

    const expiresAt = isExpired
      ? new Date(now.getTime() - 60 * 1000)
      : new Date(now.getTime() + durationMs);

    const defaultPriceMicros =
      productId === 'weeklyid'
        ? 6_990_000
        : productId === 'yearlyid'
          ? 99_000_000
          : 19_990_000;

    const priceAmountMicros = isTrial
      ? 0
      : typeof input.priceAmountMicros === 'number' &&
          Number.isFinite(input.priceAmountMicros) &&
          input.priceAmountMicros >= 0
        ? Math.round(input.priceAmountMicros)
        : defaultPriceMicros;

    const priceCurrencyCode =
      (input.priceCurrencyCode || 'USD').trim().toUpperCase() || 'USD';

    const orderId =
      input.orderId ??
      `GPA.${crypto
        .createHash('sha256')
        .update(purchaseToken)
        .digest('hex')
        .slice(0, 16)
        .toUpperCase()}`;

    return {
      productId,
      purchaseToken,
      orderId,
      expiresAt,
      willRenew: !isCanceled,
      isTrial,
      priceAmountMicros,
      priceCurrencyCode,
      acknowledged: true,
      obfuscatedAccountId: input.obfuscatedAccountId ?? null,
      rawResponse: {
        mode: 'deterministic',
        productId,
        purchaseToken,
        orderId,
        expiresAt: expiresAt.toISOString(),
        willRenew: !isCanceled,
        isTrial,
      },
    };
  }

  private async verifyWithGooglePlayApi(
    input: PlayPurchaseVerifyInput & { serviceAccountJson: string },
  ): Promise<VerifiedPlayPurchase> {
    let credentials: ServiceAccountCredentials;
    try {
      credentials = JSON.parse(
        input.serviceAccountJson,
      ) as ServiceAccountCredentials;
    } catch {
      throw new InternalServerErrorException({
        code: 'BILLING_CONFIG_ERROR',
        message: 'Cấu hình Google Play Service Account không hợp lệ.',
      });
    }

    const packageName = this.configService.get<string>(
      'GOOGLE_PLAY_PACKAGE_NAME',
      'com.palmsight.mobile2',
    );

    const accessToken = await this.fetchGoogleAccessToken(credentials);

    const subUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName,
    )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(
      input.purchaseToken,
    )}`;

    const res = await fetch(subUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok && !INVALID_TOKEN_STATUSES.has(res.status)) {
      this.logger.error(
        `Google Play subscriptionsv2 lookup is unavailable (status ${res.status})`,
      );
      throw new ServiceUnavailableException({
        code: 'billing_unavailable',
        message: 'Chưa thể xác minh giao dịch. Vui lòng thử lại sau.',
      });
    }

    if (!res.ok) {
      this.logger.warn(
        `Google Play subscriptionsv2 lookup failed with status ${res.status}`,
      );
      throw new BadRequestException({
        code: 'invalid_purchase',
        message: 'Không thể xác minh giao dịch với Google Play.',
      });
    }

    const data = (await res.json()) as Record<string, any>;
    const lineItem = Array.isArray(data.lineItems) ? data.lineItems[0] : null;
    const entitled = ENTITLED_SUBSCRIPTION_STATES.has(data.subscriptionState);
    const reportedExpiry = new Date(lineItem?.expiryTime ?? NaN);
    const hasExpiry = !Number.isNaN(reportedExpiry.getTime());

    if (!lineItem?.productId || (entitled && !hasExpiry)) {
      throw new BadRequestException({
        code: 'invalid_purchase',
        message: 'Giao dịch Google Play không có thông tin thời hạn hợp lệ.',
      });
    }

    const verifiedProductId: string = lineItem.productId;

    if (verifiedProductId !== input.productId) {
      throw new BadRequestException({
        code: 'invalid_product',
        message: 'Mã gói đăng ký không khớp với giao dịch Google Play.',
      });
    }

    // Outside the allow-list the expiry says nothing: Google does not document it for PENDING
    // or for a revoked subscription, so access ends now whatever date it reports.
    const expiredNow = new Date((input.now ?? new Date()).getTime() - 1000);
    const expiresAt = entitled
      ? reportedExpiry
      : new Date(
          Math.min(
            hasExpiry ? reportedExpiry.getTime() : Infinity,
            expiredNow.getTime(),
          ),
        );

    const autoRenewingPlan = lineItem.autoRenewingPlan;
    const willRenew = entitled && Boolean(autoRenewingPlan?.autoRenewEnabled);

    // Only a confirmed paid phase counts: a missed attribution event is cheaper than fake revenue.
    const offerPhase = lineItem.offerPhase;
    const isTrial = !(offerPhase?.basePrice || offerPhase?.introductoryPrice);

    let acknowledged =
      data.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';

    if (!acknowledged && entitled) {
      try {
        const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
          packageName,
        )}/purchases/subscriptions/${encodeURIComponent(
          input.productId,
        )}/tokens/${encodeURIComponent(input.purchaseToken)}:acknowledge`;
        const ackRes = await fetch(ackUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        acknowledged = ackRes.ok;
        if (!ackRes.ok) {
          this.logger.warn(
            `Google Play rejected the acknowledgement (status ${ackRes.status})`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to acknowledge subscription on Google Play: ${(err as Error).message}`,
        );
      }
    }

    return {
      productId: verifiedProductId,
      purchaseToken: input.purchaseToken,
      orderId:
        lineItem.latestSuccessfulOrderId ??
        data.latestOrderId ??
        input.orderId ??
        null,
      expiresAt,
      willRenew,
      isTrial,
      priceAmountMicros: isTrial
        ? 0
        : (moneyToMicros(autoRenewingPlan?.recurringPrice) ??
          input.priceAmountMicros ??
          0),
      priceCurrencyCode:
        autoRenewingPlan?.recurringPrice?.currencyCode ??
        input.priceCurrencyCode ??
        'USD',
      acknowledged,
      obfuscatedAccountId:
        data.externalAccountIdentifiers?.obfuscatedExternalAccountId ??
        input.obfuscatedAccountId ??
        null,
      rawResponse: data,
    };
  }

  private async fetchGoogleAccessToken(
    credentials: ServiceAccountCredentials,
  ): Promise<string> {
    const nowSec = Math.floor(Date.now() / 1000);
    const tokenUri =
      credentials.token_uri || 'https://oauth2.googleapis.com/token';

    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: credentials.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: tokenUri,
        iat: nowSec,
        exp: nowSec + 3600,
      }),
    ).toString('base64url');

    const unsignedToken = `${header}.${payload}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedToken);
    const signature = signer.sign(credentials.private_key, 'base64url');
    const assertion = `${unsignedToken}.${signature}`;

    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!res.ok) {
      throw new InternalServerErrorException({
        code: 'BILLING_AUTH_ERROR',
        message: 'Không thể lấy access token từ Google OAuth2.',
      });
    }

    const tokenData = (await res.json()) as { access_token: string };
    return tokenData.access_token;
  }
}
