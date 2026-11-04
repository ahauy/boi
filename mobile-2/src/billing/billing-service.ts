import { AppState, AppStateStatus, Platform } from 'react-native';
import type {
  BillingVerifyRequestDto,
  BillingVerifyResponseDto,
} from '@palmsight/shared';
import type * as IapModule from 'react-native-iap';
import * as api from '../lib/api';
import {
  finishExternalActivity,
  recordExternalActivity,
} from '../lib/external-activity';
import { getAttributionIds, trackFirstPurchase } from '../ads/revenue';
import { adsStore } from '../ads/ads-store';
import {
  getBillingConfig,
  getConfiguredSubscriptionSkus,
  isBillingConfigured,
} from './billing-config';
import {
  BillingProductInfo,
  billingStore,
  PlanKind,
} from './billing-store';

/**
 * Billing Service (Playbook §2.1, §6.1, §6.5, §11.8, §11.10)
 *
 * THE ONLY MODULE IN THE APP THAT IMPORTS THE BILLING SDK (`react-native-iap`).
 */

const RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PRODUCT_RETRY_DELAYS_MS = [1000, 3000] as const;

export type IapSdk = typeof IapModule;
export type RawPlayPurchase = IapModule.PurchaseAndroid;

export interface PurchaseResult {
  ok: boolean;
  restored?: boolean;
  canceled?: boolean;
  /** Google Play accepted the order but it cannot be confirmed yet. */
  pending?: boolean;
  /** The plan being replaced has no purchase token on this device. */
  upgradeUnavailable?: boolean;
  response?: BillingVerifyResponseDto;
  error?: string;
}

/** Translation key for what a purchase attempt should tell the user, if anything. */
export function purchaseNoticeKey(result: PurchaseResult): string | null {
  if (result.upgradeUnavailable) return 'paywall.upgradeUnavailable';
  if (result.pending) return 'paywall.pending';
  if (result.ok || result.canceled) return null;
  return 'paywall.purchaseFailed';
}

export function restoreNoticeKey(result: PurchaseResult): string | null {
  if (result.ok) return null;
  return result.error ? 'paywall.restoreFailed' : 'paywall.restoreNone';
}

export type VerifiedVipListener = (response: BillingVerifyResponseDto) => void;

let iapModuleOverride: IapSdk | null = null;
let purchaseUpdateSubscription: { remove: () => void } | null = null;
let purchaseErrorSubscription: { remove: () => void } | null = null;
let appStateSubscriptionInstalled = false;
let retryingProducts = false;
let currentBillingRef: string | null = null;
const verifiedListeners = new Set<VerifiedVipListener>();
const pendingPurchaseResolvers = new Map<
  string,
  (result: PurchaseResult) => void
>();

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
}

function getIapSdk(): IapSdk | null {
  if (iapModuleOverride) return iapModuleOverride;
  if (Platform.OS !== 'android') return null;
  try {
    return require('react-native-iap') as IapSdk;
  } catch {
    return null;
  }
}

function resolvePendingPurchase(productId: string, result: PurchaseResult): void {
  const resolver = pendingPurchaseResolvers.get(productId);
  if (!resolver) return;
  pendingPurchaseResolvers.delete(productId);
  resolver(result);
}

/**
 * Allows injecting a mock IAP SDK in unit/integration tests.
 */
export function setBillingSdkForTesting(mockSdk: IapSdk | null): void {
  iapModuleOverride = mockSdk;
}

export function setCurrentBillingRef(billingRef: string | null | undefined): void {
  currentBillingRef = billingRef ?? null;
}

export function getCurrentBillingRef(): string | null {
  return currentBillingRef;
}

export function onVerifiedPurchase(
  listener: VerifiedVipListener,
): () => void {
  verifiedListeners.add(listener);
  return () => {
    verifiedListeners.delete(listener);
  };
}

function notifyVerifiedListeners(response: BillingVerifyResponseDto): void {
  for (const listener of verifiedListeners) {
    try {
      listener(response);
    } catch (err) {
      if (isDev()) console.warn('[BillingService] Verified listener error:', err);
    }
  }
}

/**
 * Parses ISO-8601 duration strings like `P3D`, `P7D`, `P1W`, `P1M`, `P1Y` into days.
 */
export function parseIsoDurationDays(iso: string | undefined | null): number {
  if (!iso) return 0;
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/i.exec(
    iso.trim(),
  );
  if (!match) return 0;
  const years = Number(match[1] || 0);
  const months = Number(match[2] || 0);
  const weeks = Number(match[3] || 0);
  const days = Number(match[4] || 0);
  return years * 365 + months * 30 + weeks * 7 + days;
}

/**
 * Normalizes raw Google Play subscription details into `BillingProductInfo` records
 * and dynamically calculates `savingsPercent` between yearly and weekly plans (§6.1).
 */
export function normalizePlaySubscriptions(
  rawSubs: IapModule.ProductSubscriptionAndroid[],
): Record<string, BillingProductInfo> {
  const config = getBillingConfig();
  const result: Record<string, BillingProductInfo> = {};

  for (const raw of rawSubs) {
    const productId = raw.id;
    if (!productId) continue;

    // Billing Library 8 returns SKUs it could not sell as empty records with a status.
    if (raw.productStatusAndroid && raw.productStatusAndroid !== 'ok') continue;

    let planKind: PlanKind = 'yearly';
    if (productId === config.weeklyId) planKind = 'weekly';
    else if (productId === config.monthlyId) planKind = 'monthly';

    const offers = raw.subscriptionOffers ?? [];

    let baseOfferToken: string | null = null;
    let trialOfferToken: string | null = null;
    let hasFreeTrial = false;
    let freeTrialDays = 0;
    let localizedPrice = raw.displayPrice || '';
    let priceAmountMicros = 0;
    let priceCurrencyCode = raw.currency || 'USD';
    let billingPeriodIso =
      planKind === 'weekly'
        ? 'P1W'
        : planKind === 'monthly'
          ? 'P1M'
          : 'P1Y';

    for (const offer of offers) {
      const token = offer.offerTokenAndroid ?? null;
      const phases = offer.pricingPhasesAndroid?.pricingPhaseList ?? [];

      const zeroPhase = phases.find((p) => Number(p.priceAmountMicros) === 0);
      const paidPhase = phases.find((p) => Number(p.priceAmountMicros) > 0);

      if (paidPhase) {
        localizedPrice = paidPhase.formattedPrice || localizedPrice;
        priceAmountMicros = Number(paidPhase.priceAmountMicros);
        priceCurrencyCode = paidPhase.priceCurrencyCode || priceCurrencyCode;
        billingPeriodIso = paidPhase.billingPeriod || billingPeriodIso;
      }

      if (zeroPhase && token) {
        hasFreeTrial = true;
        trialOfferToken = token;
        freeTrialDays =
          parseIsoDurationDays(zeroPhase.billingPeriod) || 3;
      } else if (token && !baseOfferToken) {
        baseOfferToken = token;
      }
    }

    if (!baseOfferToken && trialOfferToken) {
      baseOfferToken = trialOfferToken;
    }

    if (!localizedPrice && priceAmountMicros > 0) {
      const amount = (priceAmountMicros / 1_000_000).toFixed(2);
      localizedPrice = `${priceCurrencyCode} ${amount}`;
    }

    result[productId] = {
      productId,
      planKind,
      title: raw.title || raw.nameAndroid || productId,
      localizedPrice,
      priceAmountMicros,
      priceCurrencyCode,
      billingPeriodIso,
      hasFreeTrial,
      freeTrialDays,
      baseOfferToken,
      trialOfferToken,
      savingsPercent: null,
    };
  }

  // Dynamically calculate savings % of Yearly compared to 52 weeks of Weekly (§6.1)
  const weekly = result[config.weeklyId];
  const yearly = result[config.yearlyId];
  if (
    weekly &&
    yearly &&
    weekly.priceAmountMicros > 0 &&
    yearly.priceAmountMicros > 0
  ) {
    const annualAtWeeklyRate = weekly.priceAmountMicros * 52;
    if (annualAtWeeklyRate > yearly.priceAmountMicros) {
      const pct = Math.round(
        ((annualAtWeeklyRate - yearly.priceAmountMicros) / annualAtWeeklyRate) *
          100,
      );
      if (pct > 0 && pct < 100) {
        yearly.savingsPercent = pct;
      }
    }
  }

  return result;
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches subscription products from Google Play with automatic retries after 1 s and 3 s (§6.5).
 */
export async function fetchBillingProductsWithRetry(): Promise<
  Record<string, BillingProductInfo>
> {
  const skus = getConfiguredSubscriptionSkus();
  if (skus.length === 0) return {};

  const iap = getIapSdk();
  if (!iap) {
    return billingStore.getState().products;
  }

  let lastErr: unknown = null;
  const maxAttempts = PRODUCT_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const rawSubs = await iap.fetchProducts({ skus, type: 'subs' });
      if (isDev()) {
        console.log(`[BillingService] fetchProducts returned ${rawSubs?.length ?? 0} products`);
      }
      const products = normalizePlaySubscriptions(
        (rawSubs ?? []) as IapModule.ProductSubscriptionAndroid[],
      );
      if (Object.keys(products).length > 0) {
        billingStore.setProducts(products);
        return products;
      }
    } catch (err) {
      lastErr = err;
    }

    if (attempt < PRODUCT_RETRY_DELAYS_MS.length) {
      await sleep(PRODUCT_RETRY_DELAYS_MS[attempt]);
    }
  }

  if (lastErr && isDev()) {
    console.warn('[BillingService] Failed to fetch products after retries:', lastErr);
  }
  return billingStore.getState().products;
}

/**
 * Verifies a single Play purchase with `/v1/billing/verify` BEFORE calling `finishTransaction` (§6.5, §11.10).
 *
 * Pitfall §11.10:
 * - Unknown price -> do NOT verify yet (first-purchase event needs it).
 * - Network/5xx -> do NOT call `finishTransaction`, retry on next launch.
 */
export async function verifyAndFinishPurchase(
  rawPurchase: RawPlayPurchase,
): Promise<BillingVerifyResponseDto | null> {
  const productId = rawPurchase.productId || rawPurchase.ids?.[0] || '';
  const purchaseToken = rawPurchase.purchaseToken || '';

  // A pending order has not been paid: Play delivers it again once it clears.
  if (!productId || !purchaseToken || rawPurchase.purchaseState !== 'purchased') {
    return null;
  }

  const knownProduct = billingStore.getState().products[productId];
  const priceAmountMicros = knownProduct?.priceAmountMicros;

  // Pitfall §11.10: Unknown price -> don't verify yet (the first-purchase event needs it).
  if (
    typeof priceAmountMicros !== 'number' ||
    !Number.isFinite(priceAmountMicros) ||
    priceAmountMicros <= 0
  ) {
    if (isDev()) {
      console.warn(
        `[BillingService] Skipping verify for ${productId}: price is unknown (§11.10)`,
      );
    }
    return null;
  }

  const priceCurrencyCode = knownProduct?.priceCurrencyCode || 'USD';
  const orderId = rawPurchase.transactionId || rawPurchase.id || null;
  const { adjustAdid, gaid } = await getAttributionIds(
    adsStore.getState().consentRegion,
  );

  const verifyPayload: BillingVerifyRequestDto = {
    productId,
    purchaseToken,
    orderId,
    priceAmountMicros,
    priceCurrencyCode,
    obfuscatedAccountId:
      rawPurchase.obfuscatedAccountIdAndroid ?? currentBillingRef ?? null,
    adjustAdid,
    gaid,
  };

  // Call server verify BEFORE finishTransaction (§6.5, §11.10).
  // If network/5xx fails, api.post throws and we do NOT finishTransaction.
  const verifyResponse = await api.post<BillingVerifyResponseDto>(
    '/billing/verify',
    verifyPayload,
  );

  // The server acknowledges too, so a failure here must not lose the verified VIP.
  if (!rawPurchase.isAcknowledgedAndroid) {
    await getIapSdk()
      ?.finishTransaction({ purchase: rawPurchase, isConsumable: false })
      .catch((err: unknown) => {
        if (isDev()) console.warn('[BillingService] finishTransaction failed:', err);
      });
  }

  billingStore.recordActivePurchaseToken(productId, purchaseToken);

  if (verifyResponse.grantedNow && verifyResponse.vipDailyGranted) {
    billingStore.setState({
      vipGiftBannerAmount: verifyResponse.vipDailyGranted,
    });
  }

  // First purchase only -> Adjust `Aj_Purchase` with paid price and order ID. The server sets
  // firstPurchase from Google's offer phase, so a trial never reaches this (§5.6).
  if (verifyResponse.firstPurchase) {
    trackFirstPurchase({
      price: priceAmountMicros / 1_000_000,
      currency: priceCurrencyCode,
      orderId: orderId || purchaseToken,
    });
  }

  notifyVerifiedListeners(verifyResponse);
  resolvePendingPurchase(productId, {
    ok: true,
    restored: Boolean(verifyResponse.restored),
    response: verifyResponse,
  });

  return verifyResponse;
}

async function handleAlreadyOwned(productId: string): Promise<void> {
  const restored = await reconcilePurchases();
  resolvePendingPurchase(
    productId,
    restored?.vip.active
      ? { ok: true, restored: true, response: restored }
      : { ok: false, error: 'Already owned' },
  );
}

function attachPurchaseListeners(): void {
  const iap = getIapSdk();
  if (!iap) return;

  purchaseUpdateSubscription?.remove();
  purchaseErrorSubscription?.remove();

  purchaseUpdateSubscription = iap.purchaseUpdatedListener((purchase) => {
    const playPurchase = purchase as RawPlayPurchase;
    if (playPurchase.purchaseState === 'pending') {
      resolvePendingPurchase(playPurchase.productId, { ok: false, pending: true });
      return;
    }

    verifyAndFinishPurchase(playPurchase)
      .then((verified) => {
        // Not verifiable yet (unknown state or price): reconcile picks it up on a later launch.
        if (!verified) {
          resolvePendingPurchase(playPurchase.productId, { ok: false, pending: true });
        }
      })
      .catch((err) => {
        if (isDev()) {
          console.warn(
            '[BillingService] Verify failed in listener (will retry next launch):',
            err,
          );
        }
        resolvePendingPurchase(playPurchase.productId, {
          ok: false,
          error: err instanceof Error ? err.message : 'Verification failed',
        });
      });
  });

  purchaseErrorSubscription = iap.purchaseErrorListener((error) => {
    for (const productId of [...pendingPurchaseResolvers.keys()]) {
      if (error.code === iap.ErrorCode.AlreadyOwned) {
        void handleAlreadyOwned(productId);
        continue;
      }
      resolvePendingPurchase(productId, {
        ok: false,
        canceled: error.code === iap.ErrorCode.UserCancelled,
        error: error.message || 'Purchase failed',
      });
    }
  });
}

/**
 * Reconciles all available purchases held by Google Play (`getAvailablePurchases` -> verify each) (§6.5).
 */
export async function reconcilePurchases(): Promise<BillingVerifyResponseDto | null> {
  if (!isBillingConfigured()) return null;
  const iap = getIapSdk();
  if (!iap) {
    billingStore.setState({ lastReconciledAt: Date.now() });
    return null;
  }

  let latestVipResponse: BillingVerifyResponseDto | null = null;
  try {
    const available = await iap.getAvailablePurchases();
    if (Array.isArray(available)) {
      for (const purchase of available) {
        try {
          const verified = await verifyAndFinishPurchase(purchase as RawPlayPurchase);
          if (verified && verified.vip.active) {
            latestVipResponse = verified;
          }
        } catch (err) {
          if (isDev()) {
            console.warn('[BillingService] Reconcile item failed:', err);
          }
        }
      }
    }
    billingStore.setState({ lastReconciledAt: Date.now() });
  } catch (err) {
    if (isDev()) {
      console.warn('[BillingService] getAvailablePurchases failed:', err);
    }
  }
  return latestVipResponse;
}

/** Prices only come from Play (§6.1): with none to show, the paywall stays closed. */
function enableBillingIfProductsLoaded(): boolean {
  const hasProducts = Object.keys(billingStore.getState().products).length > 0;
  billingStore.setState({ billingEnabled: hasProducts });
  return hasProducts;
}

/** A launch on a bad network must not cost the whole session: try again when the app returns. */
export async function retryProductsOnForeground(): Promise<void> {
  const { connected, products } = billingStore.getState();
  if (retryingProducts || !connected || Object.keys(products).length > 0) return;

  retryingProducts = true;
  try {
    await fetchBillingProductsWithRetry();
    if (enableBillingIfProductsLoaded()) await reconcilePurchases();
  } finally {
    retryingProducts = false;
  }
}

function ensureForegroundReconcileListener(): void {
  if (appStateSubscriptionInstalled) return;
  appStateSubscriptionInstalled = true;

  try {
    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void retryProductsOnForeground();
        const { lastReconciledAt, connected } = billingStore.getState();
        if (
          connected &&
          lastReconciledAt > 0 &&
          Date.now() - lastReconciledAt > RECONCILE_INTERVAL_MS
        ) {
          void reconcilePurchases();
        }
      }
    });
  } catch {
    // Non-native environment fallback
  }
}

/**
 * Playbook §6.5 Ordered Initialization:
 * Connect -> fetch products (retry after 1 s and 3 s) -> THEN attach purchase listener -> reconcile on launch.
 */
export async function initializeBilling(): Promise<boolean> {
  if (!isBillingConfigured()) {
    return false;
  }

  ensureForegroundReconcileListener();

  const iap = getIapSdk();
  if (!iap) {
    billingStore.setState({ connected: false, billingEnabled: false });
    return false;
  }

  try {
    const connected = await iap.initConnection();
    if (!connected) {
      billingStore.setState({ connected: false, billingEnabled: false });
      return false;
    }
    billingStore.setState({ connected: true });

    // 1. Fetch products first (with 1s and 3s retries)
    await fetchBillingProductsWithRetry();

    // 2. Attach purchase listener AFTER products are loaded
    attachPurchaseListeners();

    // 3. Reconcile available purchases on every launch (including guests)
    await reconcilePurchases();

    return enableBillingIfProductsLoaded();
  } catch (err) {
    if (isDev()) console.warn('[BillingService] initConnection failed:', err);
    billingStore.setState({ connected: false, billingEnabled: false });
    return false;
  }
}

/**
 * Restores existing Play purchases manually ("Restore" button in Paywall footer, §6.2 & §6.5).
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (billingStore.getState().isRestoring || billingStore.getState().isPurchasing) {
    return { ok: false, error: 'Restore already in progress' };
  }

  billingStore.setState({ isRestoring: true, lastError: null });
  try {
    if (Object.keys(billingStore.getState().products).length === 0) {
      await fetchBillingProductsWithRetry();
    }
    const vipResponse = await reconcilePurchases();
    if (vipResponse && vipResponse.vip.active) {
      return {
        ok: true,
        restored: true,
        response: vipResponse,
      };
    }
    return {
      ok: false,
      restored: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Restore failed';
    billingStore.setState({ lastError: message });
    return { ok: false, error: message };
  } finally {
    billingStore.setState({ isRestoring: false });
  }
}

/**
 * Initiates a subscription purchase or upgrade (§6.2, §6.5, §11.8):
 * - Requires `billingRef` (`obfuscatedAccountIdAndroid`).
 * - Before selling a new purchase, checks purchases Play already holds; if one gives VIP (and not upgrading),
 *   returns `{ ok: true, restored: true }` ("VIP restored") without selling a second plan.
 * - Wraps the Play payment sheet in `recordExternalActivity('payment')` / `finishExternalActivity('payment')`.
 */
export async function purchaseSubscription(
  productId: string,
  options?: {
    billingRef?: string | null;
    useTrialOffer?: boolean;
    upgradeFromProductId?: string | null;
  },
): Promise<PurchaseResult> {
  const state = billingStore.getState();
  if (state.isPurchasing || state.isRestoring) {
    return { ok: false, error: 'Purchase already in progress' };
  }

  const effectiveBillingRef = options?.billingRef ?? currentBillingRef;
  if (!effectiveBillingRef) {
    return { ok: false, error: 'Missing billingRef' };
  }
  currentBillingRef = effectiveBillingRef;

  billingStore.setState({ isPurchasing: true, lastError: null });

  try {
    // Pre-purchase check (§6.5): verify purchases Play already holds first.
    // If one already gives VIP and this is not an upgrade to a longer plan, restore VIP instead of selling again.
    if (!options?.upgradeFromProductId) {
      const existingVip = await reconcilePurchases();
      if (existingVip && existingVip.vip.active) {
        return {
          ok: true,
          restored: true,
          response: existingVip,
        };
      }
    }

    const iap = getIapSdk();
    if (!iap) {
      return { ok: false, error: 'Billing unavailable on this device' };
    }

    let product = billingStore.getState().products[productId];
    if (!product) {
      const loaded = await fetchBillingProductsWithRetry();
      product = loaded[productId];
    }

    const useTrial = Boolean(options?.useTrialOffer && product?.trialOfferToken);
    const offerToken = useTrial ? product?.trialOfferToken : product?.baseOfferToken;

    const upgradeFrom = options?.upgradeFromProductId;
    const activeToken = () =>
      upgradeFrom
        ? billingStore.getState().activePurchaseTokens[upgradeFrom]
        : undefined;

    if (upgradeFrom && !activeToken()) {
      await reconcilePurchases();
    }
    const oldToken = activeToken();

    // Without the old token Play would sell a second plan alongside the first.
    if (upgradeFrom && !oldToken) {
      return { ok: false, upgradeUnavailable: true };
    }

    recordExternalActivity('payment');
    try {
      const purchasePromise = new Promise<PurchaseResult>((resolve) => {
        pendingPurchaseResolvers.set(productId, resolve);
      });

      await iap.requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [productId],
            ...(offerToken
              ? { subscriptionOffers: [{ sku: productId, offerToken }] }
              : {}),
            obfuscatedAccountId: effectiveBillingRef,
            // §6.2: an upgrade charges the full price and replaces the old token.
            ...(oldToken && upgradeFrom
              ? {
                  purchaseToken: oldToken,
                  subscriptionProductReplacementParams: {
                    oldProductId: upgradeFrom,
                    replacementMode: 'charge-full-price' as const,
                  },
                }
              : {}),
          },
        },
      });

      return await purchasePromise;
    } finally {
      finishExternalActivity('payment');
    }
  } catch (err: any) {
    pendingPurchaseResolvers.delete(productId);
    const isCanceled = err?.code === 'user-cancelled';
    const message = err?.message || 'Purchase failed';
    if (!isCanceled) {
      billingStore.setState({ lastError: message });
    }
    return {
      ok: false,
      canceled: isCanceled,
      error: message,
    };
  } finally {
    billingStore.setState({ isPurchasing: false });
  }
}

export function resetBillingServiceForTesting(): void {
  purchaseUpdateSubscription?.remove();
  purchaseErrorSubscription?.remove();
  purchaseUpdateSubscription = null;
  purchaseErrorSubscription = null;
  pendingPurchaseResolvers.clear();
  currentBillingRef = null;
  billingStore.reset();
}
