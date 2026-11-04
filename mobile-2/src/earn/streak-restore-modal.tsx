import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Text from '../components/AppText';
import { Button } from '../components/ui';
import { watch } from '../ads/rewarded';
import { restoreCheckin } from './earn-api';
import { colors, radius, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

export interface StreakRestoreModalProps {
  visible: boolean;
  brokenStreak: number;
  restoreRemaining: number;
  onClose: () => void;
  onRestored: (state?: any) => void;
  onReset: () => void;
}

export function StreakRestoreModal({
  visible,
  brokenStreak,
  restoreRemaining,
  onClose,
  onRestored,
  onReset,
}: StreakRestoreModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  async function handleWatchAd() {
    setLoading(true);
    setError(null);
    try {
      const adResult = await watch('streak_restore', 'streak_restore');
      if (adResult.success) {
        const restored = await restoreCheckin();
        haptic.success();
        onRestored(restored);
        onClose();
      } else {
        setError('Xem hết quảng cáo để khôi phục chuỗi điểm danh.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Không thể khôi phục chuỗi lúc này. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  function handleStartAgain() {
    haptic.tap();
    onReset();
    onClose();
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

            <View style={styles.header}>
              <Text style={[type.eyebrow, { color: colors.goldLight }]}>CHUỖI ĐÃ BỊ GIÁN ĐOẠN</Text>
              <Text style={[type.headingLg, { color: colors.ink, textAlign: 'center' }]}>
                Giữ chuỗi {brokenStreak} ngày?
              </Text>
              <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
                Xem 1 quảng cáo để phục hồi chuỗi điểm danh của bạn (còn {restoreRemaining} lượt phục hồi).
              </Text>
            </View>

            {error ? (
              <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Button
                label={loading ? 'Đang mở quảng cáo…' : 'Xem quảng cáo để giữ chuỗi'}
                onPress={() => void handleWatchAd()}
                disabled={loading || restoreRemaining <= 0}
                loading={loading}
                noInterstitial
                icon={<MaterialCommunityIcons name="play-circle" size={18} color={colors.onGold} />}
              />

              <Button
                label="Bắt đầu lại từ Ngày 1"
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
  header: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
});

export default StreakRestoreModal;
