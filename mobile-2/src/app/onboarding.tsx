import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { READING_SCHOOL_LIST } from '@palmsight/shared';

import { Button } from '../components/ui';
import Text from '../components/AppText';
import CosmicBackground from '../components/CosmicBackground';
import CosmicHand from '../components/CosmicHand';
import { colors, font, radius, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';
import { useAnimatedValue } from '../lib/useAnimatedValue';
import { useReduceMotion } from '../lib/motion';
import { useOnboarding } from '../state/onboarding';

const SLIDES = [
  {
    tag: 'Khai mở thiên cơ',
    title: 'Bàn tay bạn',
    highlight: 'giữ một thiên mệnh.',
    body: 'Chụp lòng bàn tay, để AI đọc những đường chỉ đã theo bạn từ thuở sinh ra. Không cần tài khoản, không cần mật khẩu.',
  },
  {
    tag: 'Nghi thức ba bước',
    title: 'Một nghi thức',
    highlight: 'thật chậm và rõ.',
    body: 'Chọn trường phái, chọn điều bạn muốn hỏi, rồi để camera ghi lại lòng bàn tay. PalmSight lo phần còn lại.',
  },
] as const;

const RITUAL = [
  { icon: 'compass-outline' as const, title: 'Chọn trường phái', body: 'Phương Tây, phương Đông hoặc Ấn Độ.' },
  { icon: 'camera-iris' as const, title: 'Chụp lòng bàn tay', body: 'Camera hoặc ảnh có sẵn, AI tự căn khung.' },
  { icon: 'star-four-points-outline' as const, title: 'Nhận luận giải', body: 'Bài đọc riêng cùng sơ đồ Sinh · Trí · Tâm đạo.' },
];

const GLYPHS: Record<string, string> = { WESTERN: '☼', EASTERN: '☯', VEDIC: '✦' };

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { complete } = useOnboarding();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const reduceMotion = useReduceMotion();
  const entrance = useAnimatedValue(1);
  const last = index === SLIDES.length - 1;

  useEffect(() => {
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [entrance, index, reduceMotion]);

  async function begin() {
    if (finishing) return;
    setFinishing(true);
    haptic.success();
    await complete();
  }

  function next() {
    if (last) {
      void begin();
      return;
    }
    haptic.select();
    setIndex((current) => Math.min(SLIDES.length - 1, current + 1));
  }

  const slide = SLIDES[index];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <CosmicBackground />
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: font.display, fontSize: 25, letterSpacing: 1.2, color: colors.ink }}>PalmSight</Text>
          <Text style={[type.eyebrow, { color: colors.stone, letterSpacing: 2.6, fontSize: 10 }]}>COSMIC EDITION</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Bỏ qua giới thiệu" onPress={() => void begin()} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[type.captionStrong, { color: colors.mute }]}>Bỏ qua</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 220 }} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{
            flex: 1,
            gap: spacing.lg,
            opacity: entrance,
            transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}>
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                borderWidth: 1,
                borderColor: colors.glassBorder,
                borderRadius: radius.full,
                backgroundColor: colors.glassFill,
                paddingHorizontal: spacing.md,
                paddingVertical: 7,
              }}>
              <MaterialCommunityIcons name="star-four-points" size={12} color={colors.gold} />
              <Text style={[type.code, { color: colors.goldLight, letterSpacing: 1.5 }]}>{slide.tag.toUpperCase()}</Text>
            </View>
            <CosmicHand size={index === 0 ? Math.min(width * 0.58, 230) : 100} />
          </View>

          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text style={[type.displayXl, { color: colors.ink, textAlign: 'center' }]} accessibilityRole="header">
              {slide.title}
              {'\n'}
              <Text style={{ fontFamily: font.displayItalic, color: colors.goldLight }}>{slide.highlight}</Text>
            </Text>
            <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center', maxWidth: 340 }]}>{slide.body}</Text>
          </View>

          {index === 1 ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {READING_SCHOOL_LIST.map((school) => (
                  <View
                    key={school.id}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      gap: 4,
                      borderWidth: 1,
                      borderColor: colors.glassBorder,
                      borderRadius: radius.lg,
                      backgroundColor: colors.glassFill,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: 4,
                    }}>
                    <Text style={{ fontFamily: font.display, fontSize: 20, color: colors.goldLight }}>{GLYPHS[school.id] ?? '✦'}</Text>
                    <Text numberOfLines={1} style={[type.captionStrong, { color: colors.body, fontSize: 11 }]}>{school.name.replace('Chỉ tay ', '')}</Text>
                  </View>
                ))}
              </View>

              {RITUAL.map((step, position) => (
                <View key={step.title} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, backgroundColor: colors.glassFill, padding: spacing.sm }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.goldWash, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name={step.icon} size={19} color={colors.goldLight} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={[type.bodyBold, { color: colors.ink }]}>{step.title}</Text>
                    <Text style={[type.caption, { color: colors.mute }]}>{step.body}</Text>
                  </View>
                  <Text style={[type.code, { color: colors.stone }]}>{`0${position + 1}`}</Text>
                </View>
              ))}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', paddingTop: spacing.xs }}>
                <MaterialCommunityIcons name="gift-outline" size={15} color={colors.gold} />
                <Text style={[type.caption, { color: colors.goldLight }]}>Tặng 3 credits ngay lần đầu · mỗi quẻ 1 credit</Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, paddingTop: spacing.sm }}>
              {[
                { value: '3', label: 'HỆ PHÁI' },
                { value: '<60s', label: 'LUẬN GIẢI' },
                { value: '0', label: 'MẬT KHẨU' },
              ].map((item) => (
                <View key={item.label} style={{ alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontFamily: font.displayStrong, fontSize: 24, color: colors.goldLight }}>{item.value}</Text>
                  <Text style={[type.code, { color: colors.stone, fontSize: 10 }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, minHeight: 8, alignItems: 'center' }}>
          {SLIDES.map((item, position) => (
            <Pressable
              key={item.tag}
              accessibilityRole="button"
              accessibilityLabel={`Trang ${position + 1} trên ${SLIDES.length}`}
              accessibilityState={{ selected: position === index }}
              hitSlop={10}
              onPress={() => {
                haptic.select();
                setIndex(position);
              }}
              style={{ minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: position === index ? 30 : 8,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: position === index ? colors.gold : colors.glassBorder,
                }}
              />
            </Pressable>
          ))}
        </View>

        <Button label={last ? 'Bắt đầu xem bói' : 'Tiếp tục'} onPress={next} loading={finishing} size="lg" />
        {last ? <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>3 credits miễn phí · không cần đăng ký</Text> : null}
      </View>
    </View>
  );
}
