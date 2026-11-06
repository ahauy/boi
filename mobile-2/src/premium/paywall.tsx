import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme';
import { useI18n } from '../i18n';
import { ADS_CONFIG } from '../ads/ads-config';
import { runExternalActivity } from '../lib/external-activity';
import {
  billingStore,
  getBillingConfig,
  purchaseNoticeKey,
  purchaseSubscription,
  reloadProductsIfMissing,
  resolveDisplayProducts,
  restoreNoticeKey,
  restorePurchases,
  setCurrentBillingRef,
  useBillingStore,
} from '../billing';
import {
  closePaywallAfterSuccess,
  declinePaywall,
  PAYWALL_CLOSE_DELAY_MS,
  usePaywallTriggerState,
} from './paywall-triggers';

export interface PaywallModalProps {
  /** Account `billingRef` from `/v1/me` (HMAC of userId). Continue is disabled until known (§6.2). */
  billingRef?: string | null;
  /** Whether the user currently has active VIP from `/v1/me`. */
  isVip?: boolean;
  /** Current active VIP product ID (`weeklyid`, `yearlyid`, `monthlyid`). */
  vipProductId?: string | null;
  /** Terms of Service URL from `/v1/config`. */
  termsUrl?: string;
  /** Privacy Policy URL from `/v1/config`. */
  privacyUrl?: string;
  /** Called when purchase or restore succeeds with updated balance & VIP state. */
  onVerified?: (balance: number) => void;
}

export function PaywallModal({
  billingRef,
  isVip = false,
  vipProductId = null,
  termsUrl = ADS_CONFIG.urls.terms,
  privacyUrl = ADS_CONFIG.urls.privacy,
  onVerified,
}: PaywallModalProps) {
  const { t } = useI18n();
  const paywallState = usePaywallTriggerState();
  const billing = useBillingStore();
  const config = useMemo(() => getBillingConfig(), []);

  // Yearly pre-selected by default (matches 365-day streak, Playbook §6.1)
  const [selectedPlanId, setSelectedPlanId] = useState<string>(config.yearlyId);
  const [canClose, setCanClose] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    setCurrentBillingRef(billingRef ?? null);
  }, [billingRef]);

  // Reset close delay timer whenever paywall opens (§6.2: X appears after 1.5 s)
  useEffect(() => {
    if (!paywallState.isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the modal when the store closes it
      setCanClose(false);
      setStatusBanner(null);
      return;
    }

    setSelectedPlanId(config.yearlyId);
    setCanClose(false);
    const timer = setTimeout(() => {
      setCanClose(true);
    }, PAYWALL_CLOSE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [paywallState.isOpen, config.yearlyId]);

  // Swallow Android hardware Back until PAYWALL_CLOSE_DELAY_MS has elapsed (§6.2)
  useEffect(() => {
    if (!paywallState.isOpen) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canClose || billing.isPurchasing || billing.isRestoring) {
        return true; // swallow back press
      }
      declinePaywall();
      return true;
    });

    return () => sub.remove();
  }, [
    paywallState.isOpen,
    canClose,
    billing.isPurchasing,
    billing.isRestoring,
  ]);

  const { products: displayProducts, isMock, unavailable } = useMemo(
    () => resolveDisplayProducts(billing.products),
    [billing.products],
  );
  const yearlyProduct = displayProducts[config.yearlyId];
  const weeklyProduct = displayProducts[config.weeklyId];
  const monthlyProduct = config.monthlyId
    ? displayProducts[config.monthlyId]
    : undefined;

  // Chỉ có một phần gói thật: tự chọn gói đầu tiên có thật thay vì để nút tắt không rõ lý do.
  const effectivePlanId = displayProducts[selectedPlanId]
    ? selectedPlanId
    : (config.yearlyId in displayProducts
        ? config.yearlyId
        : (Object.keys(displayProducts)[0] ?? selectedPlanId));
  const selectedProduct = displayProducts[effectivePlanId];
  const [reloadingProducts, setReloadingProducts] = useState(false);
  useEffect(() => {
    if (!paywallState.isOpen || !(isMock || unavailable)) return;
    let cancelled = false;
    setReloadingProducts(true); // eslint-disable-line react-hooks/set-state-in-effect -- đang nạp gói thật khi paywall mở
    void reloadProductsIfMissing().finally(() => {
      if (!cancelled) setReloadingProducts(false);
    });
    return () => {
      cancelled = true;
    };
  }, [paywallState.isOpen, isMock, unavailable]);

  const isBusy = billing.isPurchasing || billing.isRestoring;
  const canContinue =
    Boolean(billingRef) && !isBusy && !isMock && Boolean(selectedProduct);

  const canUpgradeToYearly =
    isVip &&
    vipProductId !== config.yearlyId &&
    !isMock &&
    Boolean(yearlyProduct) &&
    Boolean(billingRef);

  const handleCloseX = useCallback(() => {
    if (!canClose || isBusy) return;
    declinePaywall();
  }, [canClose, isBusy]);

  const handlePurchase = useCallback(async () => {
    if (!canContinue || !billingRef || !selectedProduct) return;
    setStatusBanner(null);

    const res = await purchaseSubscription(effectivePlanId, {
      billingRef,
      useTrialOffer: selectedProduct.hasFreeTrial,
    });

    const notice = purchaseNoticeKey(res);
    if (notice) setStatusBanner(t(notice));

    if (res.ok) {
      if (res.response && onVerified) {
        onVerified(res.response.balance);
      }
      if (res.restored) {
        billingStore.setState({ vipRestoredNotice: true });
      }
      closePaywallAfterSuccess();
    }
  }, [
    canContinue,
    billingRef,
    selectedProduct,
    effectivePlanId,
    onVerified,
    t,
  ]);

  const handleUpgrade = useCallback(async () => {
    if (!canUpgradeToYearly || !billingRef || isBusy) return;
    setStatusBanner(null);

    const res = await purchaseSubscription(config.yearlyId, {
      billingRef,
      useTrialOffer: false,
      upgradeFromProductId: vipProductId,
    });

    const notice = purchaseNoticeKey(res);
    if (notice) setStatusBanner(t(notice));

    if (res.ok) {
      if (res.response && onVerified) {
        onVerified(res.response.balance);
      }
      closePaywallAfterSuccess();
    }
  }, [
    canUpgradeToYearly,
    billingRef,
    isBusy,
    config.yearlyId,
    vipProductId,
    onVerified,
    t,
  ]);

  const handleRestore = useCallback(async () => {
    if (isBusy) return;
    setStatusBanner(null);

    const res = await restorePurchases();
    const notice = restoreNoticeKey(res);
    if (notice) setStatusBanner(t(notice));

    if (res.ok && res.restored) {
      billingStore.setState({ vipRestoredNotice: true });
      if (res.response && onVerified) {
        onVerified(res.response.balance);
      }
      closePaywallAfterSuccess();
    }
  }, [isBusy, onVerified, t]);

  const handleOpenLegalUrl = useCallback(async (url: string) => {
    await runExternalActivity('browser', () => Linking.openURL(url)).catch(() => undefined);
  }, []);

  if (!paywallState.isOpen) {
    return null;
  }

  return (
    <Modal
      visible={paywallState.isOpen}
      animationType="slide"
      transparent={false}
      onRequestClose={handleCloseX}
    >
      <View style={styles.root}>
        {/* Top bar with delayed Close X (44pt hit target, appears after 1.5s, §6.2) */}
        <View style={styles.topBar}>
          <View style={styles.closePlaceholder}>
            {canClose ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={handleCloseX}
                disabled={isBusy}
                style={styles.closeBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={24} color={colors.mute} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerBlock}>
            <View style={styles.crownBadge}>
              <Ionicons name="sparkles" size={26} color={colors.gold} />
            </View>
            <Text style={styles.title}>{t('paywall.title')}</Text>
            <Text style={styles.subtitle}>{t('paywall.subtitle')}</Text>
          </View>

          {/* 3 Exact Benefits (§6.2: never say "unlimited" or "no ads") */}
          <View style={styles.benefitsCard}>
            <View style={styles.benefitRow}>
              <Ionicons
                name="diamond-outline"
                size={20}
                color={colors.gold}
              />
              <Text style={styles.benefitText}>
                {t('paywall.benefit.dailyGems')}
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons
                name="hand-left-outline"
                size={20}
                color={colors.gold}
              />
              <Text style={styles.benefitText}>
                {t('paywall.benefit.vipFeature')}
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={colors.gold}
              />
              <Text style={styles.benefitText}>
                {t('paywall.benefit.noBannerInterstitial')}
              </Text>
            </View>
          </View>

          {statusBanner ? (
            <View style={styles.statusBanner}>
              <Text style={styles.statusBannerText}>{statusBanner}</Text>
            </View>
          ) : null}

          {isVip ? (
            /* VIP Active State + Optional Upgrade Mode (§6.2) */
            <View style={styles.vipActiveContainer}>
              <Text style={styles.vipActiveTitle}>
                {t('paywall.vipActive.title')}
              </Text>
              <Text style={styles.vipActiveSubtitle}>
                {t('paywall.vipActive.subtitle')}
              </Text>

              {canUpgradeToYearly && yearlyProduct ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleUpgrade}
                  disabled={isBusy}
                  style={[styles.primaryCta, isBusy && styles.ctaDisabled]}
                >
                  {isBusy ? (
                    <ActivityIndicator color={colors.onGold} />
                  ) : (
                    <Text style={styles.primaryCtaText}>
                      {t('paywall.cta.upgrade', {
                        price: yearlyProduct.localizedPrice,
                      })}
                    </Text>
                  )}
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={closePaywallAfterSuccess}
                style={styles.doneBtn}
              >
                <Text style={styles.doneBtnText}>{t('common.done')}</Text>
              </Pressable>
            </View>
          ) : (
            /* Plan Cards (§6.1) */
            <View style={styles.plansContainer}>
              {/* Yearly Plan (pre-selected, matches 365-day streak) */}
              {yearlyProduct ? (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{
                  selected: effectivePlanId === config.yearlyId,
                }}
                onPress={() => setSelectedPlanId(config.yearlyId)}
                style={[
                  styles.planCard,
                  effectivePlanId === config.yearlyId && styles.planCardSelected,
                ]}
              >
                <View style={styles.planHeaderRow}>
                  <Text style={styles.planTitle}>
                    {t('paywall.plan.yearly')}
                  </Text>
                  {yearlyProduct?.savingsPercent ? (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>
                        {t('paywall.badge.save', {
                          percent: yearlyProduct.savingsPercent,
                        })}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>
                        {t('paywall.badge.popular')}
                      </Text>
                    </View>
                  )}
                </View>
                {yearlyProduct ? (
                  <Text style={styles.planPrice}>
                    {t('paywall.plan.yearlySub', {
                      price: yearlyProduct.localizedPrice,
                    })}
                  </Text>
                ) : null}
              </Pressable>
              ) : null}

              {/* Weekly Plan (Trial line as card title when eligible, then "then {price}/week" in very small type, §6.1) */}
              {weeklyProduct ? (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{
                  selected: effectivePlanId === config.weeklyId,
                }}
                onPress={() => setSelectedPlanId(config.weeklyId)}
                style={[
                  styles.planCard,
                  effectivePlanId === config.weeklyId && styles.planCardSelected,
                ]}
              >
                <View style={styles.planHeaderRow}>
                  <Text style={styles.planTitle}>
                    {weeklyProduct?.hasFreeTrial
                      ? t('paywall.plan.weeklyTrialTitle', {
                          days: weeklyProduct.freeTrialDays,
                        })
                      : t('paywall.plan.weekly')}
                  </Text>
                </View>
                {weeklyProduct ? (
                  <Text style={styles.weeklyTinyPrice}>
                    {t(weeklyProduct.hasFreeTrial ? 'paywall.plan.weeklyThen' : 'paywall.plan.weeklyPrice', {
                      price: weeklyProduct.localizedPrice,
                    })}
                  </Text>
                ) : null}
              </Pressable>
              ) : null}

              {/* Monthly Plan (Optional, hidden when ID is empty, §6.1) */}
              {config.monthlyId && monthlyProduct ? (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: effectivePlanId === config.monthlyId,
                  }}
                  onPress={() => setSelectedPlanId(config.monthlyId)}
                  style={[
                    styles.planCard,
                    effectivePlanId === config.monthlyId &&
                      styles.planCardSelected,
                  ]}
                >
                  <View style={styles.planHeaderRow}>
                    <Text style={styles.planTitle}>
                      {t('paywall.plan.monthly')}
                    </Text>
                  </View>
                  <Text style={styles.planPrice}>
                    {t('paywall.plan.monthlySub', {
                      price: monthlyProduct.localizedPrice,
                    })}
                  </Text>
                </Pressable>
              ) : null}

              {isMock && !reloadingProducts ? (
                <Text style={styles.previewNotice}>{t('paywall.previewNotice')}</Text>
              ) : null}
              {unavailable && !reloadingProducts ? (
                <Text style={styles.previewNotice}>{t('paywall.unavailableNotice')}</Text>
              ) : null}

              {/* Continue CTA (disabled until billingRef is known and while purchase/restore runs, §6.2) */}
              {unavailable ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canContinue }}
                onPress={handlePurchase}
                disabled={!canContinue}
                style={[
                  styles.primaryCta,
                  !canContinue && styles.ctaDisabled,
                ]}
              >
                {isBusy ? (
                  <ActivityIndicator color={colors.onGold} />
                ) : (
                  <Text style={styles.primaryCtaText}>
                    {t('paywall.cta.continue')}
                  </Text>
                )}
              </Pressable>
              )}
            </View>
          )}

          {/* Footer: Restore, Terms, Privacy, auto-renew + trial terms + how to cancel in Google Play (§6.2) */}
          <View style={styles.footer}>
            <View style={styles.footerLinksRow}>
              <Pressable
                accessibilityRole="button"
                onPress={handleRestore}
                disabled={isBusy}
                style={styles.footerLinkBtn}
              >
                <Text style={styles.footerLinkText}>
                  {t('paywall.footer.restore')}
                </Text>
              </Pressable>
              <Text style={styles.footerDot}>•</Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => handleOpenLegalUrl(termsUrl)}
                style={styles.footerLinkBtn}
              >
                <Text style={styles.footerLinkText}>
                  {t('paywall.footer.terms')}
                </Text>
              </Pressable>
              <Text style={styles.footerDot}>•</Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => handleOpenLegalUrl(privacyUrl)}
                style={styles.footerLinkBtn}
              >
                <Text style={styles.footerLinkText}>
                  {t('paywall.footer.privacy')}
                </Text>
              </Pressable>
            </View>

            {unavailable ? null : (
              <Text style={styles.legalCopy}>{t('paywall.footer.legal')}</Text>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Dismissible "+50 — your VIP gift for today" banner (§6.6).
 */
export function VipDailyGiftBanner() {
  const { t } = useI18n();
  const { vipGiftBannerAmount, vipRestoredNotice } = useBillingStore();

  // Shown here because the paywall closes as soon as VIP is restored (§6.5).
  if (!vipGiftBannerAmount && !vipRestoredNotice) return null;

  return (
    <View style={styles.giftBanner}>
      <View style={styles.giftBannerLeft}>
        <Ionicons
          name={vipRestoredNotice ? 'checkmark-circle-outline' : 'gift-outline'}
          size={18}
          color={colors.gold}
        />
        <Text style={styles.giftBannerText}>
          {t(vipRestoredNotice ? 'paywall.restored' : 'paywall.vipGiftToday')}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={() => {
          if (vipRestoredNotice) {
            billingStore.setState({ vipRestoredNotice: false });
          } else {
            billingStore.dismissVipGiftBanner();
          }
        }}
        hitSlop={8}
      >
        <Ionicons name="close" size={18} color={colors.mute} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  previewNotice: {
    color: colors.goldLight,
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    minHeight: 60,
  },
  closePlaceholder: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  crownBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.goldWashStrong,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: font.displayStrong,
    fontSize: 32,
    lineHeight: 38,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: font.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.body,
    textAlign: 'center',
  },
  benefitsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitText: {
    fontFamily: font.bodyStrong,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    flex: 1,
  },
  statusBanner: {
    backgroundColor: colors.goldWashStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  statusBannerText: {
    fontFamily: font.bodyStrong,
    fontSize: 14,
    color: colors.goldLight,
  },
  plansContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  planCard: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  planCardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.goldWash,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  planTitle: {
    fontFamily: font.bodyStrong,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  planPrice: {
    fontFamily: font.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.goldMid,
  },
  weeklyTinyPrice: {
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 15,
    color: colors.mute,
  },
  savingsBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  savingsBadgeText: {
    fontFamily: font.bodyStrong,
    fontSize: 11,
    color: colors.onGold,
  },
  primaryCta: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  ctaDisabled: {
    opacity: 0.48,
  },
  primaryCtaText: {
    fontFamily: font.bodyStrong,
    fontSize: 16,
    color: colors.onGold,
  },
  vipActiveContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  vipActiveTitle: {
    fontFamily: font.displayStrong,
    fontSize: 24,
    color: colors.goldLight,
  },
  vipActiveSubtitle: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.body,
    textAlign: 'center',
  },
  doneBtn: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: 140,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: font.bodyStrong,
    fontSize: 15,
    color: colors.ink,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  footerLinkBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  footerLinkText: {
    fontFamily: font.bodyMedium,
    fontSize: 13,
    color: colors.mute,
    textDecorationLine: 'underline',
  },
  footerDot: {
    color: colors.stone,
    fontSize: 12,
  },
  legalCopy: {
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.stone,
    textAlign: 'center',
  },
  giftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  giftBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  giftBannerText: {
    fontFamily: font.bodyStrong,
    fontSize: 13,
    color: colors.goldLight,
  },
});
