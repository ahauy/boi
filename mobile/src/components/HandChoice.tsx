import React from 'react';
import { Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { HandOrientation } from '@palmsight/shared';

import { PALM_OUTLINE_PATH } from './mystic/palmGeometry';
import { colors, radius, spacing, text as type } from '../theme';
import { handLabel } from '../lib/format';

interface HandChoiceProps {
  side: HandOrientation;
  selected: boolean;
  onPress: () => void;
}

export default function HandChoice({ side, selected, onPress }: HandChoiceProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={handLabel(side)}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.86 : 1 })}>
      <LinearGradient
        colors={selected ? ['rgba(212,175,55,0.16)', 'rgba(44,29,79,0.92)'] : ['rgba(20,13,38,0.92)', 'rgba(11,7,22,0.94)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderWidth: 1,
          borderColor: selected ? colors.gold : colors.hairline,
          borderRadius: radius['2xl'],
          paddingVertical: spacing.lg,
          alignItems: 'center',
          gap: spacing.sm,
        }}>
        <Svg width={58} height={76} viewBox="0 0 200 260" fill="none">
          <Path d={PALM_OUTLINE_PATH} stroke={selected ? colors.gold : colors.stone} strokeWidth="2" strokeLinecap="round" />
        </Svg>
        <Text style={[type.bodyBold, { color: selected ? colors.goldLight : colors.ink }]}>{handLabel(side)}</Text>
        <Text style={[type.code, { color: selected ? colors.gold : colors.stone }]}>{selected ? 'ĐÃ CHỌN' : 'CHẠM ĐỂ CHỌN'}</Text>
      </LinearGradient>
    </Pressable>
  );
}
