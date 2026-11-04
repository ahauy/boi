import { AppState, AppStateStatus, Platform } from 'react-native';
import type {
  BillingVerifyRequestDto,
  BillingVerifyResponseDto,
} from '@palmsight/shared';
import * as api from '../lib/api';
import {
  finishExternalActivity,
  recordExternalActivity,
} from '../lib/external-activity';
import { trackFirstPurchase } from '../ads/revenue';
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

export interface RawPlayPurchase {
  productId?: string;
  productIds?: string[];
  purchaseToken?: string;
  transactionId?: string;
  orderId?: string;
  obfuscatedAccountIdAndroid?: string;
  autoRenewingAndroid?: boolean;
  isAcknowledgedAndroid?: boolean;
  packageNameAndroid?: string;
  /** Optional override used in sandbox/test verification */
  priceAmountMicros?: number;
  priceCurrencyCode?: string;
  isTrial?: boolean;
}

export interface PurchaseResult {
  ok: boolean;
  restored?: boolean;
  canceled?: boolean;
  response?: BillingVerifyResponseDto;
  error?: string;
}

export type VerifiedVipListener = (response: BillingVerifyResponseDto) => void;

let iapModuleOverride: any = null;
let purchaseUpdateSubscription: { remove?: () => void } | null = null;
let purchaseErrorSubscription: { remove?: () => void } | null = null;
let appStateSubscriptionInstalled = false;
let currentBillingRef: string | null = null;
const verifiedListeners = new Set<VerifiedVipListener>();
const pendingPurchaseResolvers = new Map<
  string,
  (result: PurchaseResult) => void
>();

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
}

function getIapSdk(): any {
  if (iapModuleOverride) return iapModuleOverride;
  if (Platform.OS === 'web') return null;
  const injected = (globalThis as any).__PALMSIGHT_NATIVE_MODULES__?.['react-native-iap'];
  if (injected) return injected;
  if (typeof (globalThis as any).__r === 'function') return null;
  try {
    const dynamicRequire = typeof require === 'function' ? require : null;
    return dynamicRequire ? dynamicRequire('react-native-iap') : null;
  } catch {
    return null;
  }
}

/**
 * Allows injecting a mock IAP SDK in unit/integration tests.
 */
export function setBillingSdkForTesting(mockSdk: any): void {
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
  rawSubs: any[],
): Record<string, BillingProductInfo> {
  const config = getBillingConfig();
  const result: Record<string, BillingProductInfo> = {};

  for (const raw of rawSubs) {
    const productId: string = raw?.productId || raw?.sku || '';
    if (!productId) continue;

    let planKind: PlanKind = 'yearly';
    if (productId === config.weeklyId) planKind = 'weekly';
    else if (productId === config.monthlyId) planKind = 'monthly';

    const offers: any[] = Array.isArray(raw?.subscriptionOfferDetails)
      ? raw.subscriptionOfferDetails
      : [];

    let baseOfferToken: string | null = null;
    let trialOfferToken: string | null = null;
    let hasFreeTrial = false;
    let freeTrialDays = 0;
    let localizedPrice = raw?.localizedPrice || '';
    let priceAmountMicros = Number(raw?.priceAmountMicros ?? 0);
    let priceCurrencyCode = raw?.currency || raw?.priceCurrencyCode || 'USD';
    let billingPeriodIso =
      planKind === 'weekly'
        ? 'P1W'
        : planKind === 'monthly'
          ? 'P1M'
          : 'P1Y';

    for (const offer of offers) {
      const token: string | null = offer?.offerToken ?? null;
      const phases: any[] = Array.isArray(offer?.pricingPhases?.pricingPhaseList)
        ? offer.pricingPhases.pricingPhaseList
        : [];

      const zeroPhase = phases.find(
        (p) => Number(p?.priceAmountMicros ?? -1) === 0,
      );
      const paidPhase = phases.find(
        (p) => Number(p?.priceAmountMicros ?? 0) > 0,
      );

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
      title: raw?.title || raw?.name || productId,
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
  if (!iap || typeof iap.getSubscriptions !== 'function') {
    return billingStore.getState().products;
  }

  let lastErr: unknown = null;
  const maxAttempts = PRODUCT_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const rawSubs = await iap.getSubscriptions({ skus });
      if (Array.isArray(rawSubs) && rawSubs.length > 0) {
        const products = normalizePlaySubscriptions(rawSubs);
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
 * Resolves optional Adjust ADID and GAID (only when consent region is not GDPR/UNKNOWN per §5.6).
 */
async function resolveAttributionIds(): Promise<{
  adjustAdid: string | null;
  gaid: string | null;
}> {
  const { consentRegion } = adsStore.getState();
  if (consentRegion === 'GDPR' || consentRegion === 'UNKNOWN') {
    return { adjustAdid: null, gaid: null };
  }

  let adjustAdid: string | null = null;
  try {
    const dynamicRequire =
      typeof (globalThis as any).__r === 'function'
        ? null
        : typeof require === 'function'
          ? require
          : null;
    const AdjustPkg =
      (globalThis as any).__PALMSIGHT_NATIVE_MODULES__?.['react-native-adjust'] ??
      (dynamicRequire ? dynamicRequire('react-native-adjust') : null);
    if (AdjustPkg?.Adjust?.getAdid) {
      adjustAdid = await new Promise<string | null>((resolve) => {
        try {
          AdjustPkg.Adjust.getAdid((adid: string) => resolve(adid || null));
        } catch {
          resolve(null);
        }
      });
    }
  } catch {
    adjustAdid = null;
  }

  return { adjustAdid, gaid: null };
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
  options?: { isTrialSelection?: boolean },
): Promise<BillingVerifyResponseDto | null> {
  const productId =
    rawPurchase.productId ||
    (Array.isArray(rawPurchase.productIds) ? rawPurchase.productIds[0] : '') ||
    '';
  const purchaseToken = rawPurchase.purchaseToken || '';

  if (!productId || !purchaseToken) {
    return null;
  }

  const knownProduct = billingStore.getState().products[productId];
  const isTrial = Boolean(
    options?.isTrialSelection ??
      rawPurchase.isTrial ??
      (knownProduct?.hasFreeTrial &&
        rawPurchase.priceAmountMicros === 0),
  );

  const priceAmountMicros = isTrial
    ? 0
    : typeof rawPurchase.priceAmountMicros === 'number'
      ? rawPurchase.priceAmountMicros
      : knownProduct?.priceAmountMicros;

  // Pitfall §11.10: Unknown price -> don't verify yet (the first-purchase event needs it).
  if (
    !isTrial &&
    (typeof priceAmountMicros !== 'number' ||
      !Number.isFinite(priceAmountMicros) ||
      priceAmountMicros <= 0)
  ) {
    if (isDev()) {
      console.warn(
        `[BillingService] Skipping verify for ${productId}: price is unknown (§11.10)`,
      );
    }
    return null;
  }

  const priceCurrencyCode =
    rawPurchase.priceCurrencyCode ||
    knownProduct?.priceCurrencyCode ||
    'USD';
  const orderId =
    rawPurchase.orderId || rawPurchase.transactionId || null;

  const { adjustAdid, gaid } = await resolveAttributionIds();

  const verifyPayload: BillingVerifyRequestDto = {
    productId,
    purchaseToken,
    packageName: rawPurchase.packageNameAndroid,
    orderId,
    priceAmountMicros,
    priceCurrencyCode,
    isTrial,
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

  // Server verified! Now acknowledge/finish transaction with Google Play.
  const iap = getIapSdk();
  if (iap && typeof iap.finishTransaction === 'function') {
    await iap.finishTransaction({
      purchase: rawPurchase,
      isConsumable: false,
    });
  }

  billingStore.recordActivePurchaseToken(productId, purchaseToken);

  if (verifyResponse.grantedNow && verifyResponse.vipDailyGranted) {
    billingStore.setState({
      vipGiftBannerAmount: verifyResponse.vipDailyGranted,
    });
  }

  // First purchase only -> Adjust `Aj_Purchase` with paid price and order ID (never at trial start, §5.6)
  if (
    verifyResponse.firstPurchase &&
    !isTrial &&
    typeof priceAmountMicros === 'number' &&
    priceAmountMicros > 0
  ) {
    trackFirstPurchase({
      price: priceAmountMicros / 1_000_000,
      currency: priceCurrencyCode,
      orderId: orderId || purchaseToken,
    });
  }

  notifyVerifiedListeners(verifyResponse);

  const pendingResolver = pendingPurchaseResolvers.get(productId);
  if (pendingResolver) {
    pendingPurchaseResolvers.delete(productId);
    pendingResolver({
      ok: true,
      restored: Boolean(verifyResponse.restored),
      response: verifyResponse,
    });
  }

  return verifyResponse;
}

function attachPurchaseListeners(): void {
  const iap = getIapSdk();
  if (!iap) return;

  if (purchaseUpdateSubscription?.remove) {
    purchaseUpdateSubscription.remove();
  }
  if (purchaseErrorSubscription?.remove) {
    purchaseErrorSubscription.remove();
  }

  if (typeof iap.purchaseUpdatedListener === 'function') {
    purchaseUpdateSubscription = iap.purchaseUpdatedListener(
      (purchase: RawPlayPurchase) => {
        void verifyAndFinishPurchase(purchase).catch((err) => {
          if (isDev()) {
            console.warn(
              '[BillingService] Verify failed in listener (will retry next launch):',
              err,
            );
          }
          const productId = purchase?.productId || '';
          const resolver = pendingPurchaseResolvers.get(productId);
          if (resolver) {
            pendingPurchaseResolvers.delete(productId);
            resolver({
              ok: false,
              error: err instanceof Error ? err.message : 'Verification failed',
            });
          }
        });
      },
    );
  }

  if (typeof iap.purchaseErrorListener === 'function') {
    purchaseErrorSubscription = iap.purchaseErrorListener((error: any) => {
      const isCanceled =
        error?.code === 'E_USER_CANCELLED' ||
        error?.responseCode === 1;
      for (const [productId, resolver] of pendingPurchaseResolvers.entries()) {
        pendingPurchaseResolvers.delete(productId);
        resolver({
          ok: false,
          canceled: isCanceled,
          error: error?.message || 'Purchase failed',
        });
      }
    });
  }
}

/**
 * Reconciles all available purchases held by Google Play (`getAvailablePurchases` -> verify each) (§6.5).
 */
export async function reconcilePurchases(): Promise<BillingVerifyResponseDto | null> {
  if (!isBillingConfigured()) return null;
  const iap = getIapSdk();
  if (!iap || typeof iap.getAvailablePurchases !== 'function') {
    billingStore.setState({ lastReconciledAt: Date.now() });
    return null;
  }

  let latestVipResponse: BillingVerifyResponseDto | null = null;
  try {
    const available: RawPlayPurchase[] = await iap.getAvailablePurchases();
    if (Array.isArray(available)) {
      for (const purchase of available) {
        try {
          const verified = await verifyAndFinishPurchase(purchase);
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

function ensureForegroundReconcileListener(): void {
  if (appStateSubscriptionInstalled) return;
  appStateSubscriptionInstalled = true;

  try {
    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
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
  const configured = isBillingConfigured();
  billingStore.setState({ billingEnabled: configured });
  if (!configured) {
    return false;
  }

  ensureForegroundReconcileListener();

  const iap = getIapSdk();
  if (!iap || typeof iap.initConnection !== 'function') {
    billingStore.setState({ connected: false });
    return false;
  }

  try {
    await iap.initConnection();
    billingStore.setState({ connected: true });

    // 1. Fetch products first (with 1s and 3s retries)
    await fetchBillingProductsWithRetry();

    // 2. Attach purchase listener AFTER products are loaded
    attachPurchaseListeners();

    // 3. Reconcile available purchases on every launch (including guests)
    await reconcilePurchases();

    return true;
  } catch (err) {
    if (isDev()) console.warn('[BillingService] initConnection failed:', err);
    billingStore.setState({ connected: false });
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
    if (!iap || typeof iap.requestSubscription !== 'function') {
      return { ok: false, error: 'Billing unavailable on this device' };
    }

    let product = billingStore.getState().products[productId];
    if (!product) {
      const loaded = await fetchBillingProductsWithRetry();
      product = loaded[productId];
    }

    const offerToken =
      options?.useTrialOffer && product?.trialOfferToken
        ? product.trialOfferToken
        : product?.baseOfferToken;

    const oldToken = options?.upgradeFromProductId
      ? billingStore.getState().activePurchaseTokens[
          options.upgradeFromProductId
        ]
      : undefined;

    recordExternalActivity('payment');
    try {
      const purchasePromise = new Promise<PurchaseResult>((resolve) => {
        pendingPurchaseResolvers.set(productId, resolve);
      });

      await iap.requestSubscription({
        sku: productId,
        ...(offerToken
          ? {
              subscriptionOffers: [{ sku: productId, offerToken }],
            }
          : {}),
        obfuscatedAccountIdAndroid: effectiveBillingRef,
        ...(oldToken
          ? {
              purchaseTokenAndroid: oldToken,
              prorationModeAndroid: 5, // CHARGE_FULL_PRICE (§6.2: charge full price, replace old token)
            }
          : {}),
      });

      return await purchasePromise;
    } finally {
      finishExternalActivity('payment');
    }
  } catch (err: any) {
    pendingPurchaseResolvers.delete(productId);
    const isCanceled =
      err?.code === 'E_USER_CANCELLED' || err?.responseCode === 1;
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
  if (purchaseUpdateSubscription?.remove) {
    purchaseUpdateSubscription.remove();
  }
  if (purchaseErrorSubscription?.remove) {
    purchaseErrorSubscription.remove();
  }
  purchaseUpdateSubscription = null;
  purchaseErrorSubscription = null;
  pendingPurchaseResolvers.clear();
  currentBillingRef = null;
  billingStore.reset();
}
