import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, Text, View, ViewStyle, type ScrollViewInstance } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, text as type } from '../theme';
import MysticBackground from './mystic/MysticBackground';
import { Eyebrow, Subtitle, Title } from './ui';

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
  /** Tắt nền sao cho màn cần nền riêng (camera, ảnh full-bleed). */
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
        backgroundColor: 'rgba(11,7,22,0.94)',
      }}>
      <LinearGradient
        colors={['rgba(212,175,55,0)', 'rgba(212,175,55,0.28)', 'rgba(212,175,55,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 1, marginBottom: spacing.md, marginHorizontal: -spacing.xl }}
      />
      {footer}
    </View>
  ) : null;

  if (avoidKeyboard && Platform.OS === 'ios') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, overflow: 'hidden' }}>
        {background ? <MysticBackground /> : null}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          {body}
          {footerBlock}
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, overflow: 'hidden' }}>
      {background ? <MysticBackground /> : null}
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
  /** Màn tiện ích: một hàng, title 22px, bỏ eyebrow/subtitle để tiết kiệm chiều cao. */
  compact?: boolean;
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Quay lại"
      onPress={onPress}
      hitSlop={12}
      style={{ minHeight: 44, justifyContent: 'center', paddingRight: spacing.md }}>
      <Text style={[type.bodyStrong, { color: colors.goldLight }]}>‹ Quay lại</Text>
    </Pressable>
  );
}

export function ScreenHeader({ eyebrow, title, subtitle, right, onBack, compact }: ScreenHeaderProps) {
  if (compact) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 }}>
        {onBack ? <BackButton onPress={onBack} /> : null}
        <Text style={[type.headingMd, { color: colors.ink, flex: 1 }]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {right}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {onBack || right ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          {onBack ? <BackButton onPress={onBack} /> : <View />}
          {right}
        </View>
      ) : null}

      {eyebrow ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <LinearGradient
            colors={['rgba(212,175,55,0)', 'rgba(212,175,55,0.5)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 1, flex: 1 }}
          />
          <Eyebrow>{eyebrow}</Eyebrow>
          <LinearGradient
            colors={['rgba(212,175,55,0.5)', 'rgba(212,175,55,0)']}
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
