import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ReadingStatus } from '@palmsight/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, gradients, radius, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';
import { useAnimatedValue } from '../lib/useAnimatedValue';
import { useReduceMotion } from '../lib/motion';
import MysticBackground from './mystic/MysticBackground';
import PalmOracle from './mystic/PalmOracle';
import TarotCorners from './mystic/TarotCorners';

export const GOLD_GRADIENT = gradients.gold;

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  icon?: React.ReactNode;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, style, accessibilityLabel, icon }: ButtonProps) {
  const inactive = Boolean(disabled || loading);
  const content = (
    <>
      {icon}
      <Text
        style={[
          type.button,
          {
            color: variant === 'primary' ? colors.onGold : variant === 'danger' ? colors.danger : colors.goldLight,
            textAlign: 'center',
          },
        ]}>
        {label}
      </Text>
    </>
  );

  const shell: StyleProp<ViewStyle> = [
    {
      minHeight: 48,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    variant === 'outline' && {
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      backgroundColor: 'rgba(27,18,51,0.75)',
    },
    variant === 'ghost' && { backgroundColor: 'transparent' },
    variant === 'danger' && {
      borderWidth: 1,
      borderColor: 'rgba(251,113,133,0.5)',
      backgroundColor: 'rgba(76,5,25,0.28)',
    },
    inactive && { opacity: 0.45 },
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      onPress={() => {
        if (variant !== 'ghost') haptic.tap();
        onPress();
      }}
      disabled={inactive}
      android_ripple={{ color: 'rgba(247,231,180,0.16)', foreground: true }}
      style={({ pressed }) => [style, pressed && !inactive ? { opacity: 0.88 } : undefined]}>
      {variant === 'primary' && !disabled ? (
        <LinearGradient
          colors={[...GOLD_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            shell,
            {
              borderWidth: 1,
              borderColor: 'rgba(255,243,209,0.55)',
              ...shadow.gold,
            },
          ]}>
          {loading ? <ActivityIndicator size="small" color={colors.onGold} /> : content}
        </LinearGradient>
      ) : (
        <View style={shell}>{loading ? <ActivityIndicator size="small" color={colors.gold} /> : content}</View>
      )}
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

  return (
    <View style={{ gap: spacing.xs }}>
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          style={[
            {
              flex: 1,
              minHeight: multiline ? 104 : 50,
              paddingHorizontal: spacing.lg,
              paddingRight: secure ? spacing.xxl + spacing.md : spacing.lg,
              paddingVertical: multiline ? spacing.md : 0,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: error ? colors.danger : focused ? colors.gold : colors.inputBorder,
              backgroundColor: focused ? 'rgba(27,18,51,0.92)' : 'rgba(20,13,38,0.86)',
              color: colors.ink,
              fontFamily: font.body,
              fontSize: 15,
              lineHeight: 22,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}>
        </TextInput>
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
}

export function Card({ children, style, elevated, ornate, glow }: CardProps) {
  return (
    <View
      style={[
        shadow.card,
        {
          borderRadius: radius['2xl'],
          borderColor: glow ? colors.hairlineStrong : colors.hairline,
          backgroundColor: colors.card,
        },
        glow && shadow.glow,
      ]}>
      <LinearGradient
        colors={[...(elevated ? gradients.cardSoft : gradients.card)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius['2xl'] - 1, overflow: 'hidden' }}>
        <View style={[{ padding: spacing.lg, gap: spacing.md }, style]}>{children}</View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: spacing.md,
            right: spacing.md,
            height: 1,
            backgroundColor: 'rgba(247,231,180,0.18)',
          }}
        />
        {ornate ? <TarotCorners inset={10} size={14} /> : null}
      </LinearGradient>
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
    borderColor: selected ? colors.gold : colors.hairlineSoft,
    backgroundColor: selected ? colors.goldWashStrong : 'rgba(11,7,22,0.5)',
  };

  const body = (
    <>
      {onPress ? (
        <MaterialCommunityIcons
          accessible={false}
          name={mode === 'radio' ? (selected ? 'radiobox-marked' : 'radiobox-blank') : selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={16}
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
      android_ripple={{ color: 'rgba(212,175,55,0.12)', foreground: true }}
      style={({ pressed }) => [pill, pressed && { opacity: 0.82 }, style]}>
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
}

export function RadioCard({ label, description, selected, onPress, glyph }: RadioCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      android_ripple={{ color: 'rgba(212,175,55,0.12)', foreground: true }}
      style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
      <LinearGradient
        colors={
          selected
            ? ['rgba(212,175,55,0.18)', 'rgba(44,29,79,0.92)']
            : ['rgba(20,13,38,0.92)', 'rgba(11,7,22,0.94)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderWidth: 1,
          borderColor: selected ? colors.gold : colors.hairline,
          borderRadius: radius.xl,
          padding: spacing.md,
          gap: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: selected ? colors.gold : colors.hairlineSoft,
            backgroundColor: selected ? 'rgba(212,175,55,0.14)' : 'rgba(11,7,22,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {glyph ? (
            <Text style={{ fontFamily: font.display, fontSize: 22, color: selected ? colors.goldLight : colors.stone }}>{glyph}</Text>
          ) : (
            <MaterialCommunityIcons
              accessible={false}
              name={selected ? 'radiobox-marked' : 'radiobox-blank'}
              size={18}
              color={selected ? colors.gold : colors.stone}
            />
          )}
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[type.bodyBold, { color: selected ? colors.goldLight : colors.ink }]}>{label}</Text>
          {description ? <Text style={[type.caption, { color: colors.mute }]}>{description}</Text> : null}
        </View>

        {selected ? <Text style={{ fontFamily: font.display, fontSize: 16, color: colors.gold }}>✦</Text> : null}
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
          name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
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

const BANNER_PREFIX: Record<BannerVariant, string> = {
  error: '[!] ',
  success: '[+] ',
  info: '[i] ',
  warning: '[!] ',
};

const BANNER_COLOR: Record<BannerVariant, string> = {
  error: colors.danger,
  success: colors.success,
  info: colors.gold,
  warning: colors.warning,
};

interface BannerProps {
  variant?: BannerVariant;
  title?: string;
  lines?: string[];
  action?: { label: string; onPress: () => void };
}

export function Banner({ variant = 'info', title, lines = [], action }: BannerProps) {
  const color = BANNER_COLOR[variant];
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderWidth: 1,
        borderColor: `${color}55`,
        borderLeftWidth: 3,
        borderLeftColor: color,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.xs,
        backgroundColor: 'rgba(20,13,38,0.86)',
      }}>
      {title ? (
        <Text style={[type.bodyBold, { color }]}>
          {BANNER_PREFIX[variant]}
          {title}
        </Text>
      ) : null}
      {lines.map((line) => (
        <Text key={line} style={[type.caption, { color: colors.body }]}>
          {line}
        </Text>
      ))}
      {action ? (
        <Pressable accessibilityRole="link" onPress={action.onPress} hitSlop={8} style={{ paddingTop: spacing.xs }}>
          <Text style={[type.captionStrong, { color, letterSpacing: 0.2, textDecorationLine: 'underline' }]}>{action.label}</Text>
        </Pressable>
      ) : null}
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
  [ReadingStatus.DONE]: { label: 'Xong', color: colors.success, icon: 'check-circle-outline' },
  [ReadingStatus.PROCESSING]: { label: 'Đang xử lý', color: colors.warning, icon: 'clock-outline' },
  [ReadingStatus.FAILED]: { label: 'Hệ thống bận · đã hoàn 1 credit', color: colors.danger, icon: 'alert-circle-outline' },
  [ReadingStatus.REJECTED]: { label: 'Ảnh không rõ · đã hoàn 1 credit', color: colors.danger, icon: 'alert-circle-outline' },
  [ReadingStatus.GUEST_PREVIEW]: { label: 'Bói thử', color: colors.violetSoft, icon: 'star-four-points-outline' },
};

export function StatusPill({ status }: { status: ReadingStatus }) {
  const meta = STATUS_META[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' }}>
      <MaterialCommunityIcons accessible={false} name={meta.icon} size={14} color={meta.color} />
      <Text style={[type.caption, { color: meta.color }]} accessibilityLabel={`Trạng thái: ${meta.label}`}>
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
      Animated.timing(beam, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [beam, reduceMotion]);

  if (reduceMotion) return null;

  const translateY = beam.interpolate({ inputRange: [0, 1], outputRange: [0, height - 12] });
  const opacity = beam.interpolate({ inputRange: [0, 0.12, 0.86, 1], outputRange: [0, 0.95, 0.95, 0] });

  return (
    <>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: '8%', right: '8%', top: 6, height: 20, transform: [{ translateY }], opacity }}>
        <LinearGradient
          colors={['rgba(212,175,55,0)', 'rgba(212,175,55,0.3)', 'rgba(212,175,55,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: '8%', right: '8%', top: 15, height: 2, transform: [{ translateY }], opacity }}>
        <LinearGradient
          colors={['rgba(247,231,180,0)', '#f7e7b4', '#d4af37', 'rgba(247,231,180,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: 999 }}
        />
      </Animated.View>
    </>
  );
}

const SCAN_STAGES = [
  'Tải ảnh lên thiên đài',
  'Nhận diện bàn tay',
  'Vẽ Sinh · Trí · Tâm đạo',
  'Luận giải cùng AI',
] as const;

interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  message?: string;
  progress?: number;
  photoUri?: string | null;
  children?: React.ReactNode;
  /** Có thì hiện nút hủy và cho phép back (Android) thoát modal đang chờ. */
  onCancel?: () => void;
  cancelLabel?: string;
}

export function LoadingOverlay({ visible, title, message, progress, photoUri, children, onCancel, cancelLabel }: LoadingOverlayProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  const raw = Math.max(0, Math.min(1, progress ?? 0));
  // Tiến trình dựa trên bộ đếm thời gian, không phải tiến trình thật: chặn ở 90% để
  // thanh không "xong" từ giây 45 trong khi bài luận giải vẫn đang được viết.
  const clamped = Math.min(raw, 0.9);
  const activeStage = Math.min(SCAN_STAGES.length - 1, Math.floor(clamped * SCAN_STAGES.length));
  const visualWidth = 214;
  const visualHeight = 252;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      accessibilityViewIsModal
      onRequestClose={() => onCancel?.()}>
      <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <MysticBackground intensity={0.95} />

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
                <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,7,22,0.28)' }} />
                <ScanBeam height={visualHeight} />
                <TarotCorners inset={10} size={16} />
              </View>
            ) : (
              <PalmOracle size={214} />
            )}
          </View>

          <View style={{ alignItems: 'center', gap: spacing.sm, maxWidth: 360 }}>
            <Text style={[type.displayLg, { color: colors.ink, textAlign: 'center' }]} accessibilityRole="header">
              {title ?? '✦ Thiên Cơ Luận Giải ✦'}
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
                <View key={stage} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: done || active ? 1 : 0.42 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: done || active ? colors.gold : colors.hairline,
                      backgroundColor: active ? 'rgba(212,175,55,0.16)' : 'transparent',
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

          {onCancel ? <Button label={cancelLabel ?? 'Hủy và quay lại'} variant="ghost" onPress={onCancel} /> : null}

          <Text style={[type.code, { color: colors.stone, textAlign: 'center', letterSpacing: 1.4 }]}>
            {onCancel ? 'CÓ THỂ HỦY — QUẺ VẪN ĐƯỢC LƯU TRONG LỊCH SỬ' : 'ĐỪNG ĐÓNG ỨNG DỤNG · THƯỜNG MẤT DƯỚI 60 GIÂY'}
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
      style={{ width: '100%', maxWidth: 380, height: 4, borderRadius: radius.full, backgroundColor: colors.container, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#f7e7b4', '#d4af37']}
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
