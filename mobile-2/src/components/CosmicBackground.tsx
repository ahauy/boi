import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme';
import { useReduceMotion } from '../lib/motion';
import { useAnimatedValue } from '../lib/useAnimatedValue';

interface CosmicBackgroundProps {
  intensity?: number;
  /** Tắt sao để màn có ảnh full-bleed không bị nhiễu. */
  stars?: boolean;
}

function seeded(index: number): number {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export default function CosmicBackground({ intensity = 1, stars = true }: CosmicBackgroundProps) {
  const reduceMotion = useReduceMotion();
  const drift = useAnimatedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      drift.setValue(0.4);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 14000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift, reduceMotion]);

  const starField = useMemo(
    () =>
      Array.from({ length: 46 }, (_, index) => {
        const x = seeded(index + 1) * 100;
        const y = seeded(index + 47) * 100;
        const size = 1 + seeded(index + 93) * 1.8;
        const gold = index % 7 === 0;
        return { key: `star-${index}`, x, y, size, gold, opacity: 0.28 + seeded(index + 131) * 0.55 };
      }),
    []
  );

  const auroraY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const auroraX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });
  const tealX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas, overflow: 'hidden' }]}>
      <LinearGradient
        colors={['#0a1230', '#060a1b', '#040611', '#03040c']}
        locations={[0, 0.38, 0.72, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: Math.min(1, 0.72 + intensity * 0.28) }]}
      />

      <Animated.View
        style={{
          position: 'absolute',
          width: '88%',
          aspectRatio: 1,
          borderRadius: 9999,
          backgroundColor: colors.violet,
          opacity: 0.24 * intensity,
          top: '-28%',
          right: '-26%',
          transform: [{ translateY: auroraY }, { translateX: auroraX }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: '74%',
          aspectRatio: 1,
          borderRadius: 9999,
          backgroundColor: '#1fb6a6',
          opacity: 0.1 * intensity,
          top: '36%',
          left: '-42%',
          transform: [{ translateX: tealX }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: '62%',
          aspectRatio: 1,
          borderRadius: 9999,
          backgroundColor: colors.gold,
          opacity: 0.05 * intensity,
          bottom: '-28%',
          right: '-16%',
        }}
      />

      {stars
        ? starField.map((star) => (
            <View
              key={star.key}
              style={{
                position: 'absolute',
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.size,
                height: star.size,
                borderRadius: star.size,
                backgroundColor: star.gold ? colors.goldLight : '#dfe7ff',
                opacity: star.opacity * intensity,
              }}
            />
          ))
        : null}

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.035)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.22)']}
        locations={[0, 0.24, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
