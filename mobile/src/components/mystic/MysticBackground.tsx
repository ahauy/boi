import React, { memo, useEffect } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme';
import { useAnimatedValue } from '../../lib/useAnimatedValue';
import { useReduceMotion } from '../../lib/motion';

const STARS = [
  { top: '6%', left: '12%', size: 2.5, delay: 0, duration: 3500 },
  { top: '14%', left: '28%', size: 1.8, delay: 1200, duration: 4200 },
  { top: '9%', left: '72%', size: 3, delay: 500, duration: 3800 },
  { top: '19%', left: '86%', size: 1.8, delay: 2100, duration: 4500 },
  { top: '28%', left: '8%', size: 2.4, delay: 800, duration: 5000 },
  { top: '36%', left: '92%', size: 2.2, delay: 1700, duration: 3900 },
  { top: '48%', left: '15%', size: 1.8, delay: 2500, duration: 4100 },
  { top: '54%', left: '81%', size: 2.8, delay: 300, duration: 3600 },
  { top: '67%', left: '6%', size: 2.2, delay: 1400, duration: 4800 },
  { top: '73%', left: '89%', size: 1.7, delay: 2800, duration: 3700 },
  { top: '84%', left: '22%', size: 2.4, delay: 900, duration: 4400 },
  { top: '88%', left: '68%', size: 2.8, delay: 1900, duration: 5200 },
  { top: '42%', left: '48%', size: 1.6, delay: 1100, duration: 4000 },
  { top: '22%', left: '54%', size: 2.2, delay: 2300, duration: 3400 },
] as const;

function Star({ top, left, size, delay, duration, animate }: (typeof STARS)[number] & { animate: boolean }) {
  const pulse = useAnimatedValue(0);

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(pulse, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate, delay, duration, pulse]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top,
        left,
        width: size * 2,
        height: size * 2,
        borderRadius: size,
        backgroundColor: colors.goldLight,
        opacity: animate ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.9] }) : 0.55,
        transform: animate ? [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }] : undefined,
        shadowColor: colors.goldLight,
        shadowOpacity: 0.75,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

function OrbitRing({
  size,
  style,
  reverse = false,
  color = colors.gold,
  opacity = 1,
  animate,
}: {
  size: number;
  style: object;
  reverse?: boolean;
  color?: string;
  opacity?: number;
  animate: boolean;
}) {
  const spin = useAnimatedValue(0);

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: reverse ? 35000 : 45000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [animate, reverse, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] });

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style, { transform: [{ rotate }], opacity }]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 400" fill="none">
        <Circle cx="200" cy="200" r="190" stroke={color} strokeWidth="1" strokeDasharray="4 6" />
        <Circle cx="200" cy="200" r="165" stroke={color} strokeWidth="1" />
        <Circle cx="200" cy="200" r="130" stroke={color} strokeWidth="1" strokeDasharray="2 4" />
        <Circle cx="200" cy="200" r="95" stroke={color} strokeWidth="1" />
        <Polygon
          points="200,35 248,152 365,200 248,248 200,365 152,248 35,200 152,152"
          stroke={color}
          strokeWidth="1"
        />
        <Polygon
          points="83,83 200,135 317,83 265,200 317,317 200,265 83,317 135,200"
          stroke={color}
          strokeWidth="1"
        />
        <Line x1="200" y1="10" x2="200" y2="390" stroke={color} strokeWidth="0.75" />
        <Line x1="10" y1="200" x2="390" y2="200" stroke={color} strokeWidth="0.75" />
        <Line x1="65" y1="65" x2="335" y2="335" stroke={color} strokeWidth="0.75" />
        <Line x1="335" y1="65" x2="65" y2="335" stroke={color} strokeWidth="0.75" />
      </Svg>
    </Animated.View>
  );
}

function InnerOrbit({ size, style, opacity = 1, animate }: { size: number; style: object; opacity?: number; animate: boolean }) {
  const spin = useAnimatedValue(0);

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 35000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [animate, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style, { transform: [{ rotate }], opacity }]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 400" fill="none">
        <Circle cx="200" cy="200" r="185" stroke={colors.violet} strokeWidth="1" />
        <Circle cx="200" cy="200" r="150" stroke={colors.violet} strokeWidth="1" strokeDasharray="6 6" />
        <Polygon points="200,50 330,275 70,275" stroke={colors.violet} strokeWidth="1" />
        <Polygon points="200,350 330,125 70,125" stroke={colors.violet} strokeWidth="1" />
      </Svg>
    </Animated.View>
  );
}

/** Nền cosmic của web: 3 quầng radial, 2 vòng chiêm tinh quay chậm, 14 ngôi sao nhấp nháy. */
function MysticBackground({ intensity = 1 }: { intensity?: number }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const animate = !reduceMotion;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="ps-glow-top" cx={width * 0.5} cy={-height * 0.08} r={width * 0.95} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3 * intensity} />
            <Stop offset="45%" stopColor="#d4af37" stopOpacity={0.12 * intensity} />
            <Stop offset="100%" stopColor="#0b0716" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ps-glow-left" cx={-width * 0.18} cy={height * 0.46} r={width * 0.8} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#a855f7" stopOpacity={0.22 * intensity} />
            <Stop offset="55%" stopColor="#4f46e5" stopOpacity={0.08 * intensity} />
            <Stop offset="100%" stopColor="#0b0716" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ps-glow-bottom" cx={width * 1.02} cy={height * 1.02} r={width * 0.9} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#d4af37" stopOpacity={0.16 * intensity} />
            <Stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.12 * intensity} />
            <Stop offset="100%" stopColor="#0b0716" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#ps-glow-top)" />
        <Rect width={width} height={height} fill="url(#ps-glow-left)" />
        <Rect width={width} height={height} fill="url(#ps-glow-bottom)" />
      </Svg>

      <OrbitRing
        size={Math.max(width, 420) * 1.08}
        style={{ top: -Math.max(width, 420) * 0.58, right: -Math.max(width, 420) * 0.58 }}
        opacity={0.05 * intensity}
        animate={animate}
      />
      <InnerOrbit
        size={Math.max(width, 420) * 1.18}
        style={{ bottom: -Math.max(width, 420) * 0.68, left: -Math.max(width, 420) * 0.62 }}
        opacity={0.035 * intensity}
        animate={animate}
      />

      {STARS.map((star, index) => (
        <Star key={index} {...star} animate={animate} />
      ))}
    </View>
  );
}

export default memo(MysticBackground);
