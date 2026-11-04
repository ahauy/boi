import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Text from '../components/AppText';
import { Button } from '../components/ui';
import { watch } from '../ads/rewarded';
import { triggerPaywall } from '../premium/paywall-triggers';
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
  requiredGem = 5,
  onEarned,
}: NotEnoughSheetProps) {
  const [adLoading, setAdLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedAtRef = useRef<number>(0);

  useEffect(() => {
    if (visible) {
      openedAtRef.current = Date.now();
    }
  }, [visible]);

  if (!visible) return null;

  function isGuardActive(): boolean {
    return Date.now() - openedAtRef.current < DOUBLE_TAP_GUARD_MS;
  }

  async function handleWatchAd() {
    if (isGuardActive() || adLoading) return;
    setAdLoading(true);
    setError(null);
    haptic.tap();

    try {
      const res = await watch('not_enough_sheet', 'ad_reward');
      if (res.success) {
        haptic.success();
        onEarned?.();
        onClose();
      } else {
        setError('Xem hết video quảng cáo để nhận 5 GEM.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Chưa sẵn sàng mở quảng cáo lúc này.');
    } finally {
      setAdLoading(false);
    }
  }

  function handleGoToCurrency() {
    if (isGuardActive()) return;
    haptic.select();
    onClose();
    router.navigate('/(tabs)/currency' as any);
  }

  function handleGetVip() {
    if (isGuardActive()) return;
    haptic.select();
    onClose();
    void triggerPaywall('out_of_currency');
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
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
                Không đủ GEM
              </Text>
              <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
                {`Quẻ này cần ${requiredGem} GEM. Bạn hiện có ${currentBalance} GEM.`}
              </Text>
            </View>

            {error ? (
              <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {/* Watch Ad Button (+5 GEM) with 450ms guard and noInterstitial */}
              <Button
                label={adLoading ? 'Đang mở quảng cáo…' : 'Xem quảng cáo (+5 GEM)'}
                onPress={() => void handleWatchAd()}
                disabled={adLoading}
                loading={adLoading}
                noInterstitial
                icon={
                  <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.onGold} />
                }
              />

              {/* Navigate to Currency tab */}
              <Button
                label="Điểm danh / Vòng quay nhận GEM"
                variant="outline"
                onPress={handleGoToCurrency}
                noInterstitial
                icon={
                  <MaterialCommunityIcons name="fire" size={18} color={colors.goldLight} />
                }
              />

              {/* Get VIP Button */}
              <Button
                label="Mở gói VIP (50 GEM/ngày)"
                variant="ghost"
                onPress={handleGetVip}
                noInterstitial
                icon={
                  <MaterialCommunityIcons name="crown-outline" size={18} color={colors.goldLight} />
                }
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
