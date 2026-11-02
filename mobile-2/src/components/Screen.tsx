import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, View, ViewStyle, type ScrollViewInstance } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, text as type } from '../theme';
import Text from './AppText';
import CosmicBackground from './CosmicBackground';
import { Eyebrow, IconButton, Subtitle, Title } from './ui';

interface ScreenProps {
  children?: React.ReactNode;
  /** Màn camera/full-bleed đặt false để tự quản lý inset. */
  scroll?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.RefObject<ScrollViewInstance | null>;
  /** Bịt bàn phím khi nhập (iOS; Android dùng softwareKeyboardLayoutMode=resize đã khai báo ở app.json). */
  avoidKeyboard?: boolean;
  /** Tắt nền cho màn có nền riêng. */
  background?: boolean;
}

export default function Screen({ children, scroll = true, header, footer, contentStyle, scrollRef, avoidKeyboard = true, background = true }: ScreenProps) {
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={[
        { paddingHorizontal: spacing.xl, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.lg },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}>
      {header}
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        { flex: 1, paddingHorizontal: spacing.xl, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md, gap: spacing.lg },
        contentStyle,
      ]}>
      {header}
      {children}
    </View>
  );

  const footerBlock = footer ? (
    <View
      style={{
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        backgroundColor: colors.tabBar,
        borderTopWidth: 1,
        borderTopColor: colors.glassBorder,
      }}>
      {footer}
    </View>
  ) : null;

  if (avoidKeyboard && Platform.OS === 'ios') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, overflow: 'hidden' }}>
        {background ? <CosmicBackground /> : null}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          {body}
          {footerBlock}
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, overflow: 'hidden' }}>
      {background ? <CosmicBackground /> : null}
      {body}
      {footerBlock}
    </View>
  );
}

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  /** Màn tiện ích: một hàng, tiêu đề nhỏ, bỏ eyebrow/subtitle để tiết kiệm chiều cao. */
  compact?: boolean;
}

export function ScreenHeader({ eyebrow, title, subtitle, right, onBack, compact }: ScreenHeaderProps) {
  if (compact) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 46 }}>
        {onBack ? <IconButton icon="chevron-left" size={42} accessibilityLabel="Quay lại" onPress={onBack} /> : null}
        <Text
          style={[type.headingMd, { color: colors.ink, flex: 1 }]}
          accessibilityRole="header"
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}>
          {title}
        </Text>
        {right}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, gap: spacing.sm }}>
        {onBack ? <IconButton icon="chevron-left" size={42} accessibilityLabel="Quay lại" onPress={onBack} /> : <View />}
        {right}
      </View>

      {eyebrow ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <LinearGradient
            colors={['rgba(231,199,119,0)', 'rgba(231,199,119,0.6)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 1, flex: 1 }}
          />
          <Eyebrow>{eyebrow}</Eyebrow>
          <LinearGradient
            colors={['rgba(231,199,119,0.6)', 'rgba(231,199,119,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 1, flex: 1 }}
          />
        </View>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <Title>{title}</Title>
        {subtitle ? <Subtitle>{subtitle}</Subtitle> : null}
      </View>
    </View>
  );
}
