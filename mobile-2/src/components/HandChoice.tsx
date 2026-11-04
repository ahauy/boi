import React from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { HandOrientation } from '@palmsight/shared';

import { PALM_LINES, PALM_OUTLINE_PATH } from './mystic/palmGeometry';
import Text from './AppText';
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
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.86 : 1 })}>
      <LinearGradient
        colors={selected ? ['rgba(231,199,119,0.16)', 'rgba(28,38,76,0.92)'] : ['rgba(20,30,62,0.66)', 'rgba(8,13,30,0.8)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderWidth: 1,
          borderColor: selected ? colors.gold : colors.glassBorder,
          borderRadius: radius['2xl'],
          paddingVertical: spacing.lg,
          alignItems: 'center',
          gap: spacing.sm,
        }}>
        {/* Path gốc vẽ lòng bàn tay trái (ngón cái bên phải); bàn tay phải lật trục ngang */}
        <View style={{ transform: [{ scaleX: side === HandOrientation.RIGHT ? -1 : 1 }] }}>
          <Svg width={58} height={76} viewBox="0 0 200 260" fill="none">
            <Path d={PALM_OUTLINE_PATH} stroke={selected ? colors.gold : colors.stone} strokeWidth="2" strokeLinecap="round" />
            {/* Chỉ tay vẽ cùng màu nét bao, mờ hơn một bậc: đủ để đọc là lòng bàn tay, không biến thẻ thành bảng màu. */}
            {PALM_LINES.map((line) => (
              <Path
                key={line.name}
                d={line.d}
                stroke={selected ? colors.gold : colors.stone}
                strokeOpacity={0.55}
                strokeWidth={line.width}
                strokeLinecap="round"
                strokeDasharray={line.dashed ? '4 6' : undefined}
              />
            ))}
          </Svg>
        </View>
        <Text style={[type.bodyBold, { color: selected ? colors.goldLight : colors.ink }]}>{handLabel(side)}</Text>
        <Text style={[type.code, { color: selected ? colors.gold : colors.stone }]}>{selected ? 'ĐÃ CHỌN' : 'CHẠM ĐỂ CHỌN'}</Text>
      </LinearGradient>
    </Pressable>
  );
}
