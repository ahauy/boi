import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, spacing } from '../../theme';

interface MysticDividerProps {
  symbol?: string;
  compact?: boolean;
}

/** Đường chia có biểu tượng thiên văn, port từ MysticDivider.tsx của web. */
export default function MysticDivider({ symbol = '✦ ☽ ☼ ☾ ✦', compact = false }: MysticDividerProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: compact ? 2 : spacing.xs }}>
      <LinearGradient
        colors={['rgba(212,175,55,0)', 'rgba(212,175,55,0.35)', 'rgba(212,175,55,0.7)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 1, flex: 1 }}
      />
      <Text style={{ fontFamily: font.display, fontSize: compact ? 10 : 13, letterSpacing: compact ? 2 : 4, color: colors.gold }}>
        {symbol}
      </Text>
      <LinearGradient
        colors={['rgba(212,175,55,0.7)', 'rgba(212,175,55,0.35)', 'rgba(212,175,55,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 1, flex: 1 }}
      />
    </View>
  );
}
