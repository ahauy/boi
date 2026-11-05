import React, { useEffect } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../theme';
import { useAnimatedValue } from '../lib/useAnimatedValue';
import { useAppActive, useReduceMotion } from '../lib/motion';
import { PALM_DOTS, PALM_LINES, PALM_OUTLINE_PATH } from './mystic/palmGeometry';

interface CosmicHandProps {
  size?: number;
  scan?: boolean;
  /** Bàn tay nhỏ trong thẻ, tắt các vòng trang trí. */
  compact?: boolean;
}

/** Bàn tay holographic: silhouette thuỷ tinh, đường chỉ tay phát sáng, tia quét chậm. */
function CosmicHand({ size = 260, scan = true, compact = false }: CosmicHandProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '') || 'hand';
  const beam = useAnimatedValue(0);
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const animate = scan && !reduceMotion;

  useEffect(() => {
    // Tia quét vẫn được render (đứng yên) khi app ra sau; chỉ vòng lặp nghỉ để GPU được nghỉ.
    if (!animate || !appActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beam, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(beam, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate, appActive, beam]);

  const bodyHeight = size * 1.16;
  const travel = bodyHeight * 0.68;
  const translateY = beam.interpolate({ inputRange: [0, 1], outputRange: [bodyHeight * 0.18, travel] });
  const opacity = beam.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.9, 0.9, 0] });

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: bodyHeight, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={bodyHeight} viewBox="0 0 220 300" fill="none">
        <Defs>
          <RadialGradient id={`${uid}-aura`} cx="110" cy="146" r="112" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.violet} stopOpacity="0.34" />
            <Stop offset="0.55" stopColor={colors.violet} stopOpacity="0.1" />
            <Stop offset="1" stopColor={colors.violet} stopOpacity="0" />
          </RadialGradient>
          <SvgLinearGradient id={`${uid}-glass`} x1="62" y1="36" x2="146" y2="254" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#d9d4ff" stopOpacity="0.34" />
            <Stop offset="0.45" stopColor="#8b78ff" stopOpacity="0.18" />
            <Stop offset="0.75" stopColor="#4dd7cf" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#e7c777" stopOpacity="0.1" />
          </SvgLinearGradient>
          <SvgLinearGradient id={`${uid}-edge`} x1="30" y1="80" x2="180" y2="230" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#fff4d0" stopOpacity="0.85" />
            <Stop offset="0.5" stopColor={colors.gold} stopOpacity="0.55" />
            <Stop offset="1" stopColor="#9fd8ff" stopOpacity="0.35" />
          </SvgLinearGradient>
          <SvgLinearGradient id={`${uid}-beam`} x1="20" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.gold} stopOpacity="0" />
            <Stop offset="0.5" stopColor="#fff4d0" stopOpacity="0.75" />
            <Stop offset="1" stopColor={colors.gold} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        <Circle cx="110" cy="146" r="112" fill={`url(#${uid}-aura)`} />
        {!compact ? (
          <>
            <Ellipse cx="110" cy="148" rx="101" ry="131" stroke={colors.glassBorder} strokeWidth="0.8" strokeDasharray="2 7" />
            <Ellipse cx="110" cy="148" rx="88" ry="116" stroke={colors.hairlineSoft} strokeWidth="0.7" />
            <Circle cx="110" cy="148" r="72" stroke={colors.hairlineSoft} strokeWidth="0.6" strokeDasharray="1 6" />
          </>
        ) : null}

        {/* Chòm sao nền */}
        <Path d="M 26 78 L 42 62 L 66 70 L 83 52" fill="none" stroke={colors.glassHighlight} strokeOpacity="0.44" strokeWidth="0.8" />
        <Path d="M 158 42 L 176 58 L 192 50 L 198 70" fill="none" stroke={colors.glassHighlight} strokeOpacity="0.32" strokeWidth="0.8" />
        <Circle cx="26" cy="78" r="1.7" fill={colors.goldLight} />
        <Circle cx="42" cy="62" r="1.2" fill="#dfe7ff" />
        <Circle cx="66" cy="70" r="1.5" fill="#dfe7ff" />
        <Circle cx="83" cy="52" r="1.2" fill={colors.gold} />
        <Circle cx="158" cy="42" r="1.3" fill="#dfe7ff" />
        <Circle cx="176" cy="58" r="1.8" fill={colors.goldLight} />
        <Circle cx="192" cy="50" r="1" fill="#dfe7ff" />
        <Circle cx="198" cy="70" r="1.2" fill="#dfe7ff" />

        <G transform="translate(10, 18)">
          <Path d={PALM_OUTLINE_PATH} fill={`url(#${uid}-glass)`} stroke={`url(#${uid}-edge)`} strokeWidth="1.6" />
          <Path d={PALM_OUTLINE_PATH} stroke={colors.violetSoft} strokeOpacity="0.16" strokeWidth="7" />
          <Path d={PALM_OUTLINE_PATH} stroke={colors.goldLight} strokeOpacity="0.22" strokeWidth="0.8" />

          {PALM_LINES.map((line) => (
            <G key={line.name}>
              <Path d={line.d} fill="none" stroke={line.color} strokeOpacity="0.22" strokeWidth={line.width + 4} strokeLinecap="round" strokeDasharray={line.dashed ? '3 7' : undefined} />
              <Path d={line.d} fill="none" stroke={line.color} strokeWidth={line.width} strokeLinecap="round" strokeDasharray={line.dashed ? '3 7' : undefined} />
            </G>
          ))}

          {PALM_DOTS.map(([cx, cy], index) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={index === 0 ? 2.4 : 1.9} fill={index === 1 ? '#dfe7ff' : colors.goldLight} />
          ))}
        </G>

        {!compact ? (
          <>
            <Path d="M 18 214 Q 40 226 62 220" fill="none" stroke={colors.glassHighlight} strokeOpacity="0.2" strokeWidth="0.8" />
            <Path d="M 162 208 Q 185 198 202 210" fill="none" stroke={colors.glassHighlight} strokeOpacity="0.18" strokeWidth="0.8" />
          </>
        ) : null}
      </Svg>

      {animate ? (
        <Animated.View pointerEvents="none" style={[styles.beamWrap, { transform: [{ translateY }], opacity }]}>
          <LinearGradient
            colors={['rgba(231,199,119,0)', 'rgba(255,244,208,0.86)', 'rgba(124,108,246,0.35)', 'rgba(231,199,119,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.beam}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  beamWrap: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    top: 0,
    height: 2,
  },
  beam: {
    flex: 1,
    borderRadius: 999,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});

// ~30 node SVG + 4 Defs gradient: vẽ lại chỉ vì parent đổi state là lãng phí nhất trong app.
export default React.memo(CosmicHand);
