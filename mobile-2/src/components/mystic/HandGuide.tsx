import React, { useEffect } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { G, Path } from 'react-native-svg';
import { HandOrientation } from '@palmsight/shared';
import { colors, radius } from '../../theme';
import { useAnimatedValue } from '../../lib/useAnimatedValue';
import { useAppActive, useReduceMotion } from '../../lib/motion';
import { PALM_LINES, PALM_OUTLINE_PATH } from './palmGeometry';
import TarotCorners from './TarotCorners';

interface HandGuideProps {
  height: number;
  showBeam?: boolean;
  color?: string;
  /** Bàn tay người dùng đã chọn: path gốc vẽ tay phải, tay trái phải lật trục ngang. */
  hand?: HandOrientation;
  children?: React.ReactNode;
}

/** Khung ngắm bàn tay cho camera và bước chụp ảnh: silhouette + góc tarot + tia quét. */
export default function HandGuide({
  height,
  showBeam = true,
  color = colors.goldLight,
  hand = HandOrientation.RIGHT,
  children,
}: HandGuideProps) {
  const beam = useAnimatedValue(0);
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const animateBeam = showBeam && !reduceMotion;

  useEffect(() => {
    if (!animateBeam || !appActive) return;
    const loop = Animated.loop(
      Animated.timing(beam, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [animateBeam, appActive, beam]);

  const travel = Math.max(120, height * 0.82);
  const translateY = beam.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
  const opacity = beam.interpolate({ inputRange: [0, 0.12, 0.82, 1], outputRange: [0, 0.95, 0.95, 0] });

  return (
    <View style={{ height, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 8,
          right: 8,
          borderRadius: radius['3xl'],
          borderWidth: 1,
          borderColor: colors.hairline,
          backgroundColor: 'rgba(7,4,14,0.28)',
        }}>
        <TarotCorners inset={12} size={16} color={colors.gold} />
      </View>

      <Svg width="72%" height="82%" viewBox="0 0 200 260" fill="none" preserveAspectRatio="xMidYMid meet">
        <G transform={hand === HandOrientation.LEFT ? 'translate(200, 0) scale(-1, 1)' : undefined}>
          <Path d={PALM_OUTLINE_PATH} fill="none" stroke={color} strokeOpacity="0.62" strokeWidth="1.4" />
          <Path d={PALM_OUTLINE_PATH} fill="none" stroke={colors.gold} strokeOpacity="0.16" strokeWidth="6" />
          {/* Nét mờ hơn viền một bậc: đủ để đọc là lòng bàn tay mà không lẫn vào ảnh thật phía sau. */}
          {PALM_LINES.map((line) => (
            <Path
              key={line.name}
              d={line.d}
              fill="none"
              stroke={color}
              strokeOpacity={0.4}
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeDasharray={line.dashed ? '4 6' : undefined}
            />
          ))}
        </G>
      </Svg>

      {animateBeam ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.beamGlow, { transform: [{ translateY }], opacity }]}>
            <LinearGradient
              colors={['rgba(212,175,55,0)', 'rgba(212,175,55,0.28)', 'rgba(212,175,55,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.beam, { transform: [{ translateY }], opacity }]}>
            <LinearGradient
              colors={['rgba(247,231,180,0)', 'rgba(247,231,180,0.95)', 'rgba(212,175,55,0.95)', 'rgba(247,231,180,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, borderRadius: 999 }}
            />
          </Animated.View>
        </>
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  beam: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    top: 12,
    height: 2,
    borderRadius: 999,
  },
  beamGlow: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: 2,
    height: 22,
  },
});
