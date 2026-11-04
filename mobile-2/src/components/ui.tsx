import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ReadingStatus } from '@palmsight/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, gradients, radius, shadow, spacing, text as type, MAX_FONT_SCALE } from '../theme';
import { haptic } from '../lib/haptics';
import { useAnimatedValue } from '../lib/useAnimatedValue';
import { useReduceMotion } from '../lib/motion';
import { runGatedTap } from '../ui/tap-gate';
import Text from './AppText';
import CosmicBackground from './CosmicBackground';
import CosmicHand from './CosmicHand';

export const GOLD_GRADIENT = gradients.gold;

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void | Promise<any>;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  icon?: React.ReactNode;
  size?: 'md' | 'lg';
  noInterstitial?: boolean;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, style, accessibilityLabel, icon, size = 'md', noInterstitial }: ButtonProps) {
  const inactive = Boolean(disabled || loading);
  const height = size === 'lg' ? 56 : 50;
  const contentColor = disabled
    ? colors.stone
    : variant === 'primary'
      ? colors.onGold
      : variant === 'danger'
        ? colors.danger
        : colors.goldLight;

  const content = (
    <>
      {icon}
      <Text numberOfLines={1} style={[type.button, { color: contentColor, textAlign: 'center', flexShrink: 1 }]}>{label}</Text>
    </>
  );

  const shell: StyleProp<ViewStyle> = [
    {
      minHeight: height,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    variant === 'outline' && {
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassFill,
    },
    variant === 'ghost' && { backgroundColor: 'transparent' },
    variant === 'danger' && {
      borderWidth: 1,
      borderColor: 'rgba(251,113,133,0.42)',
      backgroundColor: 'rgba(59,10,26,0.4)',
    },
    variant === 'primary' && disabled && {
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassFill,
    },
    inactive && { opacity: 0.66 },
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      onPress={() => {
        if (variant !== 'ghost') haptic.tap();
        runGatedTap(() => onPress?.(), { eligibleForAd: !noInterstitial, noInterstitial });
      }}
      disabled={inactive}
      android_ripple={{ color: 'rgba(255,244,208,0.16)', foreground: true }}
      style={({ pressed }) => [style, pressed && !inactive ? { opacity: 0.86, transform: [{ scale: 0.99 }] } : undefined]}>
      {variant === 'primary' && !disabled ? (
        <LinearGradient
          colors={[...GOLD_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[shell, { borderWidth: 1, borderColor: 'rgba(255,247,221,0.55)', ...shadow.gold }]}>
          {loading ? <ActivityIndicator size="small" color={colors.onGold} /> : content}
        </LinearGradient>
      ) : (
        <View style={shell}>{loading ? <ActivityIndicator size="small" color={colors.gold} /> : content}</View>
      )}
    </Pressable>
  );
}

export function GoldButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="primary" />;
}

export function OutlineButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="outline" />;
}

export function GhostButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="ghost" />;
}

export interface IconButtonProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void | Promise<any>;
  accessibilityLabel: string;
  selected?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
  noInterstitial?: boolean;
}

export function IconButton({ icon, onPress, accessibilityLabel, selected, size = 46, style, noInterstitial }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.select();
        runGatedTap(() => onPress?.(), { eligibleForAd: !noInterstitial, noInterstitial });
      }}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: selected ? colors.gold : colors.glassBorder,
          backgroundColor: selected ? colors.goldWashStrong : 'rgba(10,16,36,0.55)',
        },
        style,
        pressed && { opacity: 0.72 },
      ]}>
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.48)} color={selected ? colors.goldLight : colors.ink} />
    </Pressable>
  );
}

interface InputProps {
  label?: string;
  accessibilityLabel?: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  secure?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: TextInputProps$AutoComplete;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  maxLength?: number;
  multiline?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: 'next' | 'done' | 'go';
  focusable?: boolean;
  editable?: boolean;
}

type TextInputProps$AutoComplete =
  | 'username'
  | 'email'
  | 'password'
  | 'new-password'
  | 'current-password'
  | 'name'
  | 'off';

export function Input({
  label,
  accessibilityLabel,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  secure,
  autoCapitalize = 'none',
  autoComplete,
  keyboardType,
  maxLength,
  multiline,
  onSubmitEditing,
  returnKeyType,
  editable = true,
}: InputProps) {
  const [revealed, setRevealed] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const { fontScale } = useWindowDimensions();
  const inputScale = fontScale > 1 ? Math.min(fontScale, MAX_FONT_SCALE) : 1;

  return (
    <View style={{ gap: spacing.sm }}>
      {label ? <Text style={[type.headingSm, { color: colors.ink }]}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.ash}
          secureTextEntry={Boolean(secure) && !revealed}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          editable={editable}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          style={{
            flex: 1,
            minHeight: multiline ? 104 : 54,
            paddingHorizontal: spacing.lg,
            paddingRight: secure ? spacing.xxl + spacing.md : spacing.lg,
            paddingVertical: multiline ? spacing.md : 0,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: error ? colors.danger : focused ? colors.gold : colors.inputBorder,
            backgroundColor: focused ? 'rgba(24,34,68,0.86)' : 'rgba(10,16,36,0.66)',
            color: colors.ink,
            fontFamily: font.body,
            fontSize: 15,
            lineHeight: 22 * inputScale,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            hitSlop={10}
            onPress={() => setRevealed((prev) => !prev)}
            style={{ position: 'absolute', right: spacing.md, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.mute} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[type.caption, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {helper ? <Text style={[type.caption, { color: colors.stone }]}>{helper}</Text> : null}
    </View>
  );
}

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  ornate?: boolean;
  glow?: boolean;
  tone?: 'glass' | 'gold' | 'violet';
}

export function Card({ children, style, elevated, ornate, glow, tone = 'glass' }: CardProps) {
  const borderColor = glow ? colors.hairlineStrong : colors.glassBorder;
  const gradient =
    tone === 'gold'
      ? (['rgba(231,199,119,0.16)', 'rgba(18,24,48,0.9)'] as const)
      : tone === 'violet'
        ? (['rgba(124,108,246,0.2)', 'rgba(8,13,30,0.94)'] as const)
        : gradients[elevated ? 'cardSoft' : 'card'];

  return (
    <View
      style={[
        shadow.card,
        {
          borderRadius: radius['2xl'],
          borderColor,
          backgroundColor: colors.cardGlassDeep,
          overflow: 'hidden',
        },
        glow && shadow.glow,
        style,
      ]}>
      <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={[{ padding: spacing.lg, gap: spacing.md }, style]}>{children}</View>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: spacing.lg, right: spacing.lg, height: 1, backgroundColor: colors.glassHighlight, opacity: 0.55 }} />
        {ornate ? <CornerSparks /> : null}
      </LinearGradient>
    </View>
  );
}

function CornerSparks() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 10, right: 10, bottom: 10 }}>
      <Text style={{ position: 'absolute', top: -6, left: -1, color: colors.gold, fontFamily: font.display, fontSize: 13 }}>✦</Text>
      <Text style={{ position: 'absolute', bottom: -7, right: 0, color: colors.gold, fontFamily: font.display, fontSize: 11 }}>✦</Text>
    </View>
  );
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  mode?: 'checkbox' | 'radio';
}

export function Chip({ label, selected, onPress, style, mode = 'checkbox' }: ChipProps) {
  const pill: StyleProp<ViewStyle> = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: selected ? colors.gold : colors.glassBorder,
    backgroundColor: selected ? colors.goldWashStrong : colors.glassFill,
  };

  const body = (
    <>
      {onPress ? (
        <MaterialCommunityIcons
          accessible={false}
          name={mode === 'radio' ? (selected ? 'radiobox-marked' : 'radiobox-blank') : selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={15}
          color={selected ? colors.gold : colors.stone}
        />
      ) : null}
      <Text style={[type.caption, { color: selected ? colors.goldLight : colors.body, flexShrink: 1 }]}>{label}</Text>
    </>
  );

  if (!onPress) return <View style={[pill, style]}>{body}</View>;

  return (
    <Pressable
      accessibilityRole={mode === 'radio' ? 'radio' : 'checkbox'}
      accessibilityLabel={label}
      accessibilityState={{ checked: Boolean(selected) }}
      aria-checked={Boolean(selected)}
      onPress={onPress}
      android_ripple={{ color: 'rgba(231,199,119,0.12)', foreground: true }}
      style={({ pressed }) => [pill, pressed && { opacity: 0.8 }, style]}>
      {body}
    </Pressable>
  );
}

interface RadioCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  glyph?: string;
  badge?: string;
}

export function RadioCard({ label, description, selected, onPress, glyph, badge }: RadioCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      android_ripple={{ color: 'rgba(231,199,119,0.12)', foreground: true }}
      style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}>
      <LinearGradient
        colors={selected ? ['rgba(231,199,119,0.16)', 'rgba(28,38,76,0.88)'] : ['rgba(20,30,62,0.66)', 'rgba(8,13,30,0.78)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderWidth: 1,
          borderColor: selected ? colors.gold : colors.glassBorder,
          borderRadius: radius.xl,
          padding: spacing.md,
          gap: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: selected ? colors.gold : colors.glassBorder,
            backgroundColor: selected ? colors.goldWashStrong : colors.glassFill,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {glyph ? (
            <Text style={{ fontFamily: font.display, fontSize: 24, color: selected ? colors.goldLight : colors.stone }}>{glyph}</Text>
          ) : (
            <MaterialCommunityIcons
              accessible={false}
              name={selected ? 'radiobox-marked' : 'radiobox-blank'}
              size={19}
              color={selected ? colors.gold : colors.stone}
            />
          )}
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[type.bodyBold, { color: selected ? colors.goldLight : colors.ink }]}>{label}</Text>
          {description ? <Text style={[type.caption, { color: colors.mute }]} numberOfLines={2}>{description}</Text> : null}
        </View>

        {badge ? (
          <View style={{ borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.ivoryWash }}>
            <Text style={[type.code, { color: colors.goldLight }]}>{badge}</Text>
          </View>
        ) : selected ? (
          <MaterialCommunityIcons accessible={false} name="check-circle" size={18} color={colors.gold} />
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  error?: string;
}

export function Checkbox({ label, checked, onChange, error }: CheckboxProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        aria-checked={checked}
        onPress={() => onChange(!checked)}
        hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 44, paddingVertical: spacing.xs }}>
        <MaterialCommunityIcons
          accessible={false}
          name={checked ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
          size={22}
          color={checked ? colors.gold : colors.stone}
        />
        <Text style={[type.caption, { color: colors.body, flex: 1 }]}>{label}</Text>
      </Pressable>
      {error ? (
        <Text style={[type.caption, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type BannerVariant = 'error' | 'success' | 'info' | 'warning';

const BANNER_META: Record<BannerVariant, { color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  error: { color: colors.danger, icon: 'alert-circle-outline' },
  success: { color: colors.success, icon: 'check-circle-outline' },
  info: { color: colors.gold, icon: 'star-four-points-outline' },
  warning: { color: colors.warning, icon: 'alert-outline' },
};

interface BannerProps {
  variant?: BannerVariant;
  title?: string;
  lines?: string[];
  action?: { label: string; onPress: () => void };
}

export function Banner({ variant = 'info', title, lines = [], action }: BannerProps) {
  const meta = BANNER_META[variant];
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderWidth: 1,
        borderColor: `${meta.color}44`,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        backgroundColor: 'rgba(10,16,36,0.72)',
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}>
      <MaterialCommunityIcons accessible={false} name={meta.icon} size={18} color={meta.color} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        {title ? <Text style={[type.bodyBold, { color: meta.color }]}>{title}</Text> : null}
        {lines.map((line) => (
          <Text key={line} style={[type.caption, { color: colors.body }]}>
            {line}
          </Text>
        ))}
        {action ? (
          <Pressable accessibilityRole="link" onPress={action.onPress} hitSlop={8} style={{ paddingTop: spacing.xs, minHeight: 32, justifyContent: 'center' }}>
            <Text style={[type.captionStrong, { color: meta.color, textDecorationLine: 'underline' }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Eyebrow({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.eyebrow, { color: colors.gold }, style]}>{children}</Text>;
}

export function Title({ children, level = 1 }: { children: string; level?: 1 | 2 }) {
  return (
    <Text style={[level === 1 ? type.headingLg : type.headingMd, { color: colors.ink }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Subtitle({ children }: { children: string }) {
  return <Text style={[type.bodyMd, { color: colors.mute }]}>{children}</Text>;
}

export function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Text style={[type.eyebrow, { color: colors.gold }]}>{children}</Text>
      <View style={{ height: 1, flex: 1, backgroundColor: colors.hairlineSoft }} />
      {right}
    </View>
  );
}

type StatusIcon = keyof typeof MaterialCommunityIcons.glyphMap;

const STATUS_META: Record<ReadingStatus, { label: string; color: string; icon: StatusIcon }> = {
  [ReadingStatus.DONE]: { label: 'Hoàn tất', color: colors.success, icon: 'check-circle-outline' },
  [ReadingStatus.PROCESSING]: { label: 'Đang luận giải', color: colors.warning, icon: 'clock-outline' },
  [ReadingStatus.FAILED]: { label: 'Lỗi · đã hoàn', color: colors.danger, icon: 'alert-circle-outline' },
  [ReadingStatus.REJECTED]: { label: 'Ảnh mờ · đã hoàn', color: colors.danger, icon: 'alert-circle-outline' },
  [ReadingStatus.GUEST_PREVIEW]: { label: 'Bói thử', color: colors.violetSoft, icon: 'star-four-points-outline' },
};

export function StatusPill({ status }: { status: ReadingStatus }) {
  const meta = STATUS_META[status];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        maxWidth: '100%',
        flexShrink: 1,
        borderWidth: 1,
        borderColor: `${meta.color}33`,
        borderRadius: radius.full,
        backgroundColor: `${meta.color}0f`,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
      }}>
      <MaterialCommunityIcons accessible={false} name={meta.icon} size={12} color={meta.color} />
      <Text numberOfLines={1} style={[type.code, { color: meta.color, flexShrink: 1 }]} accessibilityLabel={`Trạng thái: ${meta.label}`}>
        {meta.label}
      </Text>
    </View>
  );
}

function ScanBeam({ height }: { height: number }) {
  const beam = useAnimatedValue(0);
  const reduceMotion = useReduceMotion();

  React.useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beam, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(beam, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [beam, reduceMotion]);

  if (reduceMotion) return null;

  const translateY = beam.interpolate({ inputRange: [0, 1], outputRange: [10, height - 18] });
  const opacity = beam.interpolate({ inputRange: [0, 0.12, 0.86, 1], outputRange: [0, 0.95, 0.95, 0] });

  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: '8%', right: '8%', top: 0, height: 2, transform: [{ translateY }], opacity }}>
      <LinearGradient
        colors={['rgba(231,199,119,0)', '#fff4d0', colors.gold, 'rgba(231,199,119,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1, borderRadius: 999 }}
      />
    </Animated.View>
  );
}

const SCAN_STAGES = ['Đánh thức thiên đài', 'Nhận diện bàn tay', 'Vẽ Sinh · Trí · Tâm đạo', 'Luận giải cùng AI'] as const;

interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  message?: string;
  progress?: number;
  photoUri?: string | null;
  children?: React.ReactNode;
  onCancel?: () => void;
  cancelLabel?: string;
}

export function LoadingOverlay({ visible, title, message, progress, photoUri, children, onCancel, cancelLabel }: LoadingOverlayProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  const raw = Math.max(0, Math.min(1, progress ?? 0));
  const clamped = Math.min(raw, 0.9);
  const activeStage = Math.min(SCAN_STAGES.length - 1, Math.floor(clamped * SCAN_STAGES.length));
  const visualWidth = 210;
  const visualHeight = 246;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent accessibilityViewIsModal onRequestClose={() => onCancel?.()}>
      <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <CosmicBackground intensity={0.9} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}
          showsVerticalScrollIndicator={false}>
          <Text style={[type.eyebrow, { color: colors.gold, letterSpacing: 3 }]}>PALMSIGHT · THIÊN CƠ LUẬN GIẢI</Text>

          <View style={{ width: visualWidth, height: visualHeight, alignItems: 'center', justifyContent: 'center' }}>
            {photoUri ? (
              <View
                style={{
                  width: visualWidth,
                  height: visualHeight,
                  borderRadius: radius['3xl'],
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.hairlineStrong,
                  backgroundColor: colors.obsidian,
                }}>
                <View style={{ width: '100%', height: '100%' }}>
                  <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Ảnh lòng bàn tay đang được phân tích" />
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,6,17,0.24)' }]} />
                  <ScanBeam height={visualHeight} />
                </View>
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius['3xl'], borderWidth: 1, borderColor: colors.glassBorder }} />
              </View>
            ) : (
              <CosmicHand size={210} />
            )}
          </View>

          <View style={{ alignItems: 'center', gap: spacing.sm, maxWidth: 360 }}>
            <Text style={[type.displayLg, { color: colors.ink, textAlign: 'center' }]} accessibilityRole="header">
              {title ?? 'Đang đọc chỉ tay'}
            </Text>
            <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center' }]}>
              {message ?? 'Hệ thống đang phân tích các đặc điểm lòng bàn tay của bạn.'}
            </Text>
          </View>

          {typeof progress === 'number' ? <ProgressBar value={clamped} /> : null}

          <View style={{ width: '100%', maxWidth: 380, gap: spacing.sm }}>
            {SCAN_STAGES.map((stage, index) => {
              const done = index < activeStage;
              const active = index === activeStage;
              return (
                <View key={stage} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: done || active ? 1 : 0.38 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: done || active ? colors.gold : colors.glassBorder,
                      backgroundColor: active ? colors.goldWashStrong : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={[type.monoStrong, { color: done || active ? colors.gold : colors.stone }]}>
                      {done ? '✓' : active ? '✦' : `${index + 1}`}
                    </Text>
                  </View>
                  <Text style={[active ? type.bodyBold : type.caption, { color: active ? colors.goldLight : done ? colors.body : colors.stone, flex: 1 }]}>
                    {stage}
                  </Text>
                </View>
              );
            })}
          </View>

          {children}

          {onCancel ? <Button label={cancelLabel ?? 'Huỷ và quay lại'} variant="ghost" onPress={onCancel} /> : null}

          <Text style={[type.code, { color: colors.stone, textAlign: 'center', letterSpacing: 1.2 }]}>
            {onCancel ? 'CÓ THỂ HUỶ — QUẺ VẪN ĐƯỢC LƯU TRONG LỊCH SỬ' : 'ĐỪNG ĐÓNG ỨNG DỤNG · THƯỜNG DƯỚI 60 GIÂY'}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ width: '100%', maxWidth: 380, height: 5, borderRadius: radius.full, backgroundColor: colors.container, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#fff4d0', colors.gold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${clamped * 100}%`, height: '100%', borderRadius: radius.full }}
      />
    </View>
  );
}

export function TextLink({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<TextStyle> }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={10}
      style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <Text style={[type.bodyStrong, { color: colors.gold }, style]}>{label}</Text>
    </Pressable>
  );
}

export function LinkFooter({ question, action, onPress }: { question: string; action: string; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
      <Text style={[type.caption, { color: colors.mute }]}>{question}</Text>
      <TextLink label={action} onPress={onPress} />
    </View>
  );
}
