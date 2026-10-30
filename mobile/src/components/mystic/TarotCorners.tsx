import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

interface TarotCornersProps {
  inset?: number;
  size?: number;
  color?: string;
}

/** Bốn góc khung tarot, port từ MysticDivider.tsx của web. */
export default function TarotCorners({ inset = 10, size = 14, color = colors.gold }: TarotCornersProps) {
  const corner = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderColor: color,
    opacity: 0.62,
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[corner, { top: inset, left: inset, borderTopWidth: 1, borderLeftWidth: 1 }]} />
      <View style={[corner, { top: inset, right: inset, borderTopWidth: 1, borderRightWidth: 1 }]} />
      <View style={[corner, { bottom: inset, left: inset, borderBottomWidth: 1, borderLeftWidth: 1 }]} />
      <View style={[corner, { bottom: inset, right: inset, borderBottomWidth: 1, borderRightWidth: 1 }]} />
    </View>
  );
}
