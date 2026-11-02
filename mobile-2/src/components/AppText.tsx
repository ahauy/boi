import React from 'react';
import { StyleSheet, Text as RNText, useWindowDimensions, type TextProps, type TextStyle } from 'react-native';
import { MAX_FONT_SCALE } from '../theme';

/**
 * Text tôn trọng Dynamic Type nhưng có trần MAX_FONT_SCALE. React Native chỉ scale fontSize,
 * không scale lineHeight, nên lineHeight được nhân cùng hệ số để chữ không bị cắt.
 */
export default function Text({ style, maxFontSizeMultiplier = MAX_FONT_SCALE, allowFontScaling, ...rest }: TextProps) {
  const { fontScale } = useWindowDimensions();
  const effectiveScale = allowFontScaling === false ? 1 : Math.min(fontScale, maxFontSizeMultiplier ?? fontScale);
  const flattened = effectiveScale > 1.01 ? (StyleSheet.flatten(style) as TextStyle | undefined) : undefined;
  const scaledLineHeight =
    flattened?.lineHeight && flattened.lineHeight > 0 ? { lineHeight: flattened.lineHeight * effectiveScale } : null;

  return (
    <RNText
      {...rest}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={scaledLineHeight ? [style, scaledLineHeight] : style}
    />
  );
}
