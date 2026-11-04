import React, { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { CurrencyEarnResponseDto } from '@palmsight/shared';

import Text from '../components/AppText';
import { Button } from '../components/ui';
import { watchForAction } from '../ads/rewarded';
import { spinFreeWheel, spinPaidWheel } from './earn-api';
import { useReduceMotion } from '../lib/motion';
import { colors, radius, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

export const WHEEL_SLICES = [5, 5, 5, 10, 10, 15, 25, 50] as const;
const SLICE_COUNT = WHEEL_SLICES.length;
const SLICE_ANGLE = 360 / SLICE_COUNT;

export interface LuckyWheelProps {
  earnState?: CurrencyEarnResponseDto | null;
  onUpdated?: () => void;
}

export function LuckyWheel({ earnState, onUpdated }: LuckyWheelProps) {
  const reduceMotion = useReduceMotion();
  const [spinning, setSpinning] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rotationAnim = useRef(new Animated.Value(0)).current;
  const currentAngleRef = useRef(0);

  const wheelData = earnState?.wheel;
  const freeSpinAvailable = wheelData?.freeSpinAvailable ?? true;
  const adSpinsRemaining = wheelData?.adSpinsRemaining ?? 3;
  const gemSpinCost = wheelData?.gemSpinCost ?? 5;

  function animateToSlice(sliceIndex: number, amount: number) {
    // 5 full rotations (1800 deg) + target angle offset
    const targetSliceAngle = (360 - (sliceIndex * SLICE_ANGLE + SLICE_ANGLE / 2)) % 360;
    const extraRotations = 360 * 5;
    const finalAngle = currentAngleRef.current + extraRotations + targetSliceAngle;

    if (reduceMotion) {
      currentAngleRef.current = finalAngle;
      rotationAnim.setValue(finalAngle);
      setSpinning(false);
      setResultMessage(`Chúc mừng! Bạn nhận được +${amount} GEM!`);
      haptic.success();
      onUpdated?.();
      return;
    }

    Animated.timing(rotationAnim, {
      toValue: finalAngle,
      duration: 4200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      currentAngleRef.current = finalAngle;
      setSpinning(false);
      setResultMessage(`Chúc mừng! Bạn nhận được +${amount} GEM!`);
      haptic.success();
      onUpdated?.();
    });
  }

  async function handleFreeSpin() {
    if (spinning) return;
    setSpinning(true);
    setResultMessage(null);
    setError(null);
    haptic.tap();

    try {
      // 1. User watches rewarded ad first per §5.3
      const ad = await watchForAction('lucky_wheel');
      if (!ad.completed) {
        setSpinning(false);
        setError('Xem hết quảng cáo để nhận lượt quay.');
        return;
      }

      // 2. Call server spin
      const res = await spinFreeWheel();
      const sliceIdx =
        res.prizeIndex !== undefined && res.prizeIndex >= 0 && res.prizeIndex < SLICE_COUNT
          ? res.prizeIndex
          : 0;
      animateToSlice(sliceIdx, res.amount || WHEEL_SLICES[sliceIdx]);
    } catch (err: any) {
      setSpinning(false);
      setError(err?.message ?? 'Không thể quay lúc này. Vui lòng thử lại.');
    }
  }

  async function handlePaidSpin() {
    if (spinning) return;
    setSpinning(true);
    setResultMessage(null);
    setError(null);
    haptic.tap();

    try {
      const res = await spinPaidWheel();
      const sliceIdx =
        res.prizeIndex !== undefined && res.prizeIndex >= 0 && res.prizeIndex < SLICE_COUNT
          ? res.prizeIndex
          : 0;
      animateToSlice(sliceIdx, res.amount || WHEEL_SLICES[sliceIdx]);
    } catch (err: any) {
      setSpinning(false);
      setError(err?.message ?? 'Không thể quay bằng GEM lúc này.');
    }
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
          <Text style={[type.eyebrow, { color: colors.goldLight }]}>VÒNG QUAY MAY MẮN</Text>
          <Text style={[type.caption, { color: colors.stone }]}>
            Quay mỗi ngày để nhận thêm GEM thưởng.
          </Text>
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
            {WHEEL_SLICES.map((prize, idx) => {
              const angle = idx * SLICE_ANGLE;
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

        {/* Action buttons (odds are server-side, NEVER displayed per §7.3) */}
        <View style={styles.actions}>
          <Button
            label={
              spinning
                ? 'Đang quay…'
                : freeSpinAvailable
                  ? 'Xem quảng cáo để quay miễn phí'
                  : `Quay bằng quảng cáo (${adSpinsRemaining} lượt còn lại)`
            }
            onPress={() => void handleFreeSpin()}
            disabled={spinning}
            loading={spinning}
            noInterstitial
            icon={
              <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.onGold} />
            }
          />

          <Button
            label={`Quay với ${gemSpinCost} GEM`}
            variant="outline"
            onPress={() => void handlePaidSpin()}
            disabled={spinning}
            noInterstitial
            icon={<MaterialCommunityIcons name="diamond-stone" size={16} color={colors.goldLight} />}
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
