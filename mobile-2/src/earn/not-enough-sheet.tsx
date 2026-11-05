import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Text from '../components/AppText';
import { Button } from '../components/ui';
import { AdRewardKind, ECONOMY_DEFAULTS } from '@palmsight/shared';
import { watch } from '../ads/rewarded';
import { registerOpenSheet, triggerPaywall } from '../premium/paywall-triggers';
import { useBillingStore } from '../billing';
import { useAuth } from '../state/auth';
import { useI18n } from '../i18n';
import { colors, radius, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

export const DOUBLE_TAP_GUARD_MS = 450;

export interface NotEnoughSheetProps {
  visible: boolean;
  onClose: () => void;
  currentBalance?: number;
  requiredGem?: number;
  onEarned?: () => void;
}

export function NotEnoughSheet({
  visible,
  onClose,
  currentBalance = 0,
  requiredGem = ECONOMY_DEFAULTS.PRICE_PER_ACTION,
  onEarned,
}: NotEnoughSheetProps) {
  const { user } = useAuth();
  const { billingEnabled } = useBillingStore();
  const { t } = useI18n();
  const [adLoading, setAdLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedAtRef = useRef<number>(0);

  useEffect(() => {
    if (visible) {
      openedAtRef.current = Date.now();
      return registerOpenSheet();
    }
  }, [visible]);

  if (!visible) return null;

  const bonusAmount = ECONOMY_DEFAULTS.BONUS_AD_AMOUNT;
  const showGetVip = !user?.vip?.active && billingEnabled;

  function isGuardActive(): boolean {
    return Date.now() - openedAtRef.current < DOUBLE_TAP_GUARD_MS;
  }

  function handleDismiss() {
    if (!isGuardActive()) onClose();
  }

  async function handleWatchAd() {
    if (isGuardActive() || adLoading) return;
    setAdLoading(true);
    setError(null);
    haptic.tap();

    const result = await watch('not_enough_sheet', AdRewardKind.BONUS);
    setAdLoading(false);

    if (result.status === 'rewarded') {
      haptic.success();
      onEarned?.();
      onClose();
    } else if (result.status === 'capped') {
      setError(t('earn.reward.limitReached'));
    } else if (result.status === 'no_ad') {
      setError(t('earn.reward.noAd'));
    } else if (result.status === 'closed') {
      setError(t('earn.reward.watchFull'));
    } else {
      setError(result.errorMessage ?? t('earn.reward.noAd'));
    }
  }

  function handleGetVip() {
    if (isGuardActive()) return;
    haptic.select();
    onClose();
    void triggerPaywall('not_enough_sheet');
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleDismiss}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        <View style={styles.sheetContainer}>
          <LinearGradient
            colors={['rgba(28,38,76,0.98)', 'rgba(8,13,30,0.98)']}
            style={styles.sheet}>
            <View style={styles.pill} />

            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="diamond-stone" size={32} color={colors.goldLight} />
            </View>

            <View style={styles.header}>
              <Text style={[type.headingLg, { color: colors.ink, textAlign: 'center' }]}>
                {t('earn.notEnough.title')}
              </Text>
              <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
                {t('earn.notEnough.body', { price: requiredGem, balance: currentBalance })}
              </Text>
            </View>

            {error ? (
              <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Button
                label={t('earn.notEnough.watchAd', { amount: bonusAmount })}
                onPress={() => void handleWatchAd()}
                disabled={adLoading}
                loading={adLoading}
                noInterstitial
                icon={
                  <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.onGold} />
                }
              />

              {showGetVip ? (
                <Button
                  label={t('earn.notEnough.getVip')}
                  variant="outline"
                  onPress={handleGetVip}
                  noInterstitial
                  icon={
                    <MaterialCommunityIcons name="crown-outline" size={18} color={colors.goldLight} />
                  }
                />
              ) : null}

              <Button
                label={t('common.close')}
                variant="ghost"
                onPress={handleDismiss}
                noInterstitial
              />
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(4,6,17,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    ...shadow.card,
    width: '100%',
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  sheet: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl + spacing.md,
    gap: spacing.lg,
    alignItems: 'center',
  },
  pill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.stone,
    opacity: 0.5,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.goldWashStrong,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
});

export default NotEnoughSheet;
