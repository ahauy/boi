import React, { useEffect } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { colors } from '../../theme';
import { useAnimatedValue } from '../../lib/useAnimatedValue';
import { useReduceMotion } from '../../lib/motion';
import {
  PALM_CRESCENT_PATH,
  PALM_DOTS,
  PALM_EYE_PATH,
  PALM_LINES,
  PALM_OUTLINE_PATH,
} from './palmGeometry';

interface PalmOracleProps {
  size?: number;
  showRings?: boolean;
  showLines?: boolean;
  float?: boolean;
}

/** Bàn tay "ấn chứng thiên mệnh" port từ web, có vòng chiêm tinh quay và nhịp float. */
export default function PalmOracle({ size = 280, showRings = true, showLines = true, float = true }: PalmOracleProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '') || 'palm';
  const reduceMotion = useReduceMotion();
  const spin = useAnimatedValue(0);
  const spinReverse = useAnimatedValue(0);
  const levitate = useAnimatedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    const a = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 45000, easing: Easing.linear, useNativeDriver: true })
    );
    const b = Animated.loop(
      Animated.timing(spinReverse, { toValue: 1, duration: 35000, easing: Easing.linear, useNativeDriver: true })
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [reduceMotion, spin, spinReverse]);

  useEffect(() => {
    if (!float || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(levitate, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(levitate, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float, reduceMotion, levitate]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateReverse = spinReverse.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const translateY = levitate.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const handWidth = size * 0.56;
  const handHeight = handWidth * 1.3;

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg pointerEvents="none" width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${uid}-aura`} cx={size * 0.5} cy={size * 0.5} r={size * 0.48} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={colors.gold} stopOpacity="0.3" />
            <Stop offset="48%" stopColor={colors.violet} stopOpacity="0.2" />
            <Stop offset="100%" stopColor={colors.violet} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size * 0.5} cy={size * 0.5} r={size * 0.48} fill={`url(#${uid}-aura)`} />
      </Svg>

      {showRings ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.ring, { width: size, height: size, transform: [{ rotate }] }]}>
            <Svg width="100%" height="100%" viewBox="0 0 360 360" fill="none">
              <Circle cx="180" cy="180" r="172" stroke={colors.gold} strokeOpacity="0.42" strokeWidth="1" strokeDasharray="3 6" />
              <Circle cx="180" cy="180" r="156" stroke={colors.gold} strokeOpacity="0.5" strokeWidth="1.2" />
              <Circle cx="180" cy="180" r="134" stroke={colors.gold} strokeOpacity="0.3" strokeWidth="0.8" strokeDasharray="6 4" />
              <Polygon
                points="180,24 222,138 336,180 222,222 180,336 138,222 24,180 138,138"
                stroke={colors.gold}
                strokeOpacity="0.42"
                strokeWidth="0.9"
              />
              <Polygon
                points="70,70 180,118 290,70 242,180 290,290 180,242 70,290 118,180"
                stroke={colors.gold}
                strokeOpacity="0.32"
                strokeWidth="0.9"
              />
              <Circle cx="180" cy="24" r="3.5" fill={colors.goldLight} fillOpacity="0.9" />
              <Circle cx="336" cy="180" r="3.5" fill={colors.goldLight} fillOpacity="0.9" />
              <Circle cx="180" cy="336" r="3.5" fill={colors.goldLight} fillOpacity="0.9" />
              <Circle cx="24" cy="180" r="3.5" fill={colors.goldLight} fillOpacity="0.9" />
            </Svg>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { width: size * 0.72, height: size * 0.72, transform: [{ rotate: rotateReverse }] }]}>
            <Svg width="100%" height="100%" viewBox="0 0 260 260" fill="none">
              <Circle cx="130" cy="130" r="122" stroke={colors.violet} strokeOpacity="0.46" strokeWidth="1" strokeDasharray="2 5" />
              <Polygon points="130,16 229,187 31,187" stroke={colors.violet} strokeOpacity="0.4" strokeWidth="0.9" />
              <Polygon points="130,244 229,73 31,73" stroke={colors.violet} strokeOpacity="0.4" strokeWidth="0.9" />
            </Svg>
          </Animated.View>
        </>
      ) : null}

      <Animated.View pointerEvents="none" style={{ width: handWidth, height: handHeight, transform: [{ translateY }] }}>
        <Svg width="100%" height="100%" viewBox="0 0 200 260" fill="none">
          <Defs>
            <SvgLinearGradient id={`${uid}-outline`} x1="0" y1="0" x2="200" y2="260" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#fff3d1" />
              <Stop offset="50%" stopColor={colors.gold} />
              <Stop offset="100%" stopColor={colors.violet} />
            </SvgLinearGradient>
            <SvgLinearGradient id={`${uid}-fill`} x1="100" y1="15" x2="100" y2="245" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor={colors.elevated} stopOpacity="0.72" />
              <Stop offset="100%" stopColor={colors.canvas} stopOpacity="0.94" />
            </SvgLinearGradient>
          </Defs>

          <Path d={PALM_OUTLINE_PATH} fill={`url(#${uid}-fill)`} stroke={`url(#${uid}-outline)`} strokeWidth="2" />

          {showLines
            ? PALM_LINES.map((line) => (
                <Path
                  key={line.name}
                  d={line.d}
                  stroke={line.color}
                  strokeWidth={line.width}
                  strokeLinecap="round"
                  strokeDasharray={line.dashed ? '3 3' : undefined}
                />
              ))
            : null}

          {PALM_DOTS.map(([cx, cy]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" fill="#fff3d1" />
          ))}

          <Path d={PALM_EYE_PATH} stroke={colors.goldLight} strokeWidth="1.5" fill="rgba(212,175,55,0.15)" />
          <Circle cx="104" cy="166" r="5" fill={colors.gold} />
          <Circle cx="104" cy="166" r="2" fill={colors.canvas} />
          <Path d={PALM_CRESCENT_PATH} fill={colors.goldLight} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute' },
});
