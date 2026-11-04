import React, { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AdRewardKind, ECONOMY_DEFAULTS } from '@palmsight/shared';
import type { CurrencyEarnResponseDto } from '@palmsight/shared';

import Text from '../components/AppText';
import { Button } from '../components/ui';
import { watch } from '../ads/rewarded';
import { spinFreeWheel } from './earn-api';
import { useI18n } from '../i18n';
import { useAnimatedValue } from '../lib/useAnimatedValue';
import { useReduceMotion } from '../lib/motion';
import { useAuth } from '../state/auth';
import { colors, radius, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

const SPIN_DURATION_MS = 4200;

export interface LuckyWheelProps {
  earnState?: CurrencyEarnResponseDto | null;
  onUpdated?: () => void;
}

export function LuckyWheel({ earnState, onUpdated }: LuckyWheelProps) {
  const reduceMotion = useReduceMotion();
  const { t } = useI18n();
  const { setCreditBalance } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rotationAnim = useAnimatedValue(0);
  const currentAngleRef = useRef(0);

  const wheelData = earnState?.wheel;
  const freeSpinAvailable = wheelData?.freeSpinAvailable ?? true;
  const adSpinsRemaining = wheelData?.adSpinsRemaining ?? 3;
  const hasSpinsLeft = freeSpinAvailable || adSpinsRemaining > 0;
  const prizes: readonly number[] = wheelData?.prizes ?? ECONOMY_DEFAULTS.WHEEL_PRIZES;
  const sliceAngle = 360 / prizes.length;

  function animateToSlice(sliceIndex: number, amount: number) {
    // 5 full rotations (1800 deg) + target angle offset
    const targetSliceAngle = (360 - sliceIndex * sliceAngle) % 360;
    const currentTurns = Math.ceil(currentAngleRef.current / 360);
    const finalAngle = (currentTurns + 5) * 360 + targetSliceAngle;

    if (reduceMotion) {
      currentAngleRef.current = finalAngle;
      rotationAnim.setValue(finalAngle);
      setSpinning(false);
      setResultMessage(t('earn.wheel.won', { amount }));
      haptic.success();
      onUpdated?.();
      return;
    }

    Animated.timing(rotationAnim, {
      toValue: finalAngle,
      duration: SPIN_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      currentAngleRef.current = finalAngle;
      setSpinning(false);
      setResultMessage(t('earn.wheel.won', { amount }));
      haptic.success();
      onUpdated?.();
    });
  }

  function beginSpin(): boolean {
    if (spinning) return false;
    setSpinning(true);
    setResultMessage(null);
    setError(null);
    haptic.tap();
    return true;
  }

  async function handleFreeSpin() {
    if (!beginSpin()) return;
    try {
      const res = await spinFreeWheel();
      setCreditBalance(res.balance);
      animateToSlice(res.prizeIndex, res.amount);
    } catch (err) {
      setSpinning(false);
      setError(err instanceof Error ? err.message : t('earn.reward.noAd'));
      onUpdated?.();
    }
  }

  async function handleAdSpin() {
    if (!beginSpin()) return;
    const result = await watch('lucky_wheel', AdRewardKind.SPIN);

    if (result.status === 'rewarded' && result.claim?.prizeIndex != null) {
      animateToSlice(result.claim.prizeIndex, result.claim.amount);
      return;
    }

    setSpinning(false);
    if (result.status === 'capped') setError(t('earn.reward.limitReached'));
    else if (result.status === 'no_ad') setError(t('earn.reward.noAd'));
    else if (result.status === 'closed') setError(t('earn.reward.watchFull'));
    else setError(result.errorMessage ?? t('scan.unexpected'));
    onUpdated?.();
  }

  const spinInterpolation = rotationAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(28,38,76,0.66)', 'rgba(8,13,30,0.92)']}
        style={styles.card}>
        <View style={styles.header}>
          <Text style={[type.eyebrow, { color: colors.goldLight }]}>{t('earn.segment.wheel')}</Text>
          <Text style={[type.caption, { color: colors.stone }]}>{t('earn.wheel.subtitle')}</Text>
        </View>

        {/* Pointer indicator */}
        <View style={styles.pointerContainer}>
          <MaterialCommunityIcons name="menu-down" size={32} color={colors.goldLight} />
        </View>

        {/* Visual Wheel */}
        <View style={styles.wheelWrapper}>
          <Animated.View
            style={[
              styles.wheelCircle,
              { transform: [{ rotate: spinInterpolation }] },
            ]}>
            {prizes.map((prize, idx) => {
              const angle = idx * sliceAngle;
              return (
                <View
                  key={idx}
                  style={[
                    styles.sliceTextContainer,
                    { transform: [{ rotate: `${angle}deg` }] },
                  ]}>
                  <Text style={[type.captionStrong, styles.sliceText]}>
                    {`+${prize}`}
                  </Text>
                </View>
              );
            })}
          </Animated.View>

          {/* Hub center */}
          <View style={styles.wheelHub}>
            <MaterialCommunityIcons name="star-four-points" size={20} color={colors.goldLight} />
          </View>
        </View>

        {resultMessage ? (
          <View style={styles.resultBanner}>
            <Text style={[type.headingSm, { color: colors.goldLight, textAlign: 'center' }]}>
              {resultMessage}
            </Text>
          </View>
        ) : null}

        {error ? (
          <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>
            {error}
          </Text>
        ) : null}

        {/* Không có nút quay bằng GEM để chống spam. Odds nằm ở server và không bao giờ hiển thị (§7.3). */}
        <View style={styles.actions}>
          <Button
            label={
              spinning
                ? t('common.loading')
                : freeSpinAvailable
                  ? t('earn.wheel.freeSpin')
                  : adSpinsRemaining > 0
                    ? t('earn.wheel.adSpin', { left: adSpinsRemaining })
                    : t('earn.wheel.noSpins')
            }
            onPress={() => void (freeSpinAvailable ? handleFreeSpin() : handleAdSpin())}
            disabled={spinning || !hasSpinsLeft}
            loading={spinning}
            variant={hasSpinsLeft ? 'primary' : 'outline'}
            noInterstitial
            icon={
              <MaterialCommunityIcons
                name={
                  freeSpinAvailable
                    ? 'star-four-points'
                    : hasSpinsLeft
                      ? 'play-circle-outline'
                      : 'clock-outline'
                }
                size={18}
                color={hasSpinsLeft ? colors.onGold : colors.stone}
              />
            }
          />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...shadow.card,
    width: '100%',
    borderRadius: radius['3xl'],
    overflow: 'hidden',
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    gap: 2,
  },
  pointerContainer: {
    marginBottom: -14,
    zIndex: 10,
  },
  wheelWrapper: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: 'rgba(12,18,40,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliceTextContainer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  sliceText: {
    color: colors.goldLight,
    fontSize: 13,
  },
  wheelHub: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(22,32,66,0.95)',
    borderWidth: 2,
    borderColor: colors.hairlineStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultBanner: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.goldWashStrong,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
});

export default LuckyWheel;
