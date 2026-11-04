import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { CheckinRestoreOfferDto } from '@palmsight/shared';

import Text from '../components/AppText';
import { Button } from '../components/ui';
import { restoreCheckin } from './earn-api';
import { registerOpenSheet, triggerPaywall } from '../premium/paywall-triggers';
import { useBillingStore } from '../billing';
import { useAuth } from '../state/auth';
import { useI18n } from '../i18n';
import { colors, radius, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

export interface StreakRestoreModalProps {
  visible: boolean;
  offer: CheckinRestoreOfferDto | null | undefined;
  onClose: () => void;
  /** The streak was kept and today is claimed. */
  onRestored: () => void;
  /** The user gave up the streak: run the normal claim. */
  onStartAgain: () => void;
  /** Non-VIP tapped "Get VIP": the popup reopens in its VIP form if the purchase lands (§7.2). */
  onGetVip: () => void;
}

export function StreakRestoreModal({
  visible,
  offer,
  onClose,
  onRestored,
  onStartAgain,
  onGetVip,
}: StreakRestoreModalProps) {
  const { user, setCreditBalance } = useAuth();
  const { billingEnabled } = useBillingStore();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) return registerOpenSheet();
  }, [visible]);

  if (!visible || !offer) return null;

  const isVip = Boolean(user?.vip?.active);
  const balance = user?.creditBalance ?? 0;
  const canAfford = balance >= offer.cost;
  const days = offer.streakToKeep;

  async function handleRestore() {
    setLoading(true);
    setError(null);
    try {
      const restored = await restoreCheckin();
      setCreditBalance(restored.balance);
      haptic.success();
      onRestored();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : null);
    } finally {
      setLoading(false);
    }
  }

  function handleGetVip() {
    haptic.select();
    onGetVip();
    onClose();
    void triggerPaywall('streak_restore_popup');
  }

  function handleStartAgain() {
    haptic.tap();
    onClose();
    onStartAgain();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(28,38,76,0.98)', 'rgba(8,13,30,0.98)']}
            style={styles.cardContent}>
            <View style={styles.flameIcon}>
              <MaterialCommunityIcons name="fire-alert" size={36} color={colors.goldLight} />
            </View>

            <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>
              {isVip ? t('earn.restore.cardTitle', { days }) : t('earn.restore.nonVipBody', { days })}
            </Text>

            {error ? (
              <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {isVip ? (
                <Button
                  label={
                    canAfford
                      ? t('earn.restore.vipBtn', { days, cost: offer.cost })
                      : t('earn.restore.needGems', { cost: offer.cost })
                  }
                  onPress={() => void handleRestore()}
                  disabled={loading || !canAfford}
                  loading={loading}
                  noInterstitial
                />
              ) : billingEnabled ? (
                <Button
                  label={t('earn.restore.getVipBtn')}
                  onPress={handleGetVip}
                  disabled={loading}
                  noInterstitial
                  icon={<MaterialCommunityIcons name="crown" size={18} color={colors.onGold} />}
                />
              ) : null}

              <Button
                label={t('earn.restore.startAgainBtn')}
                variant="ghost"
                onPress={handleStartAgain}
                disabled={loading}
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
    backgroundColor: 'rgba(4,6,17,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    ...shadow.card,
    width: '100%',
    maxWidth: 380,
    borderRadius: radius['3xl'],
    overflow: 'hidden',
  },
  cardContent: {
    padding: spacing.xl,
    gap: spacing.lg,
    alignItems: 'center',
  },
  flameIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.goldWashStrong,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
});

export default StreakRestoreModal;
