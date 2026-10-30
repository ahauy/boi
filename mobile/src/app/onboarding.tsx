import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { READING_SCHOOL_LIST } from '@palmsight/shared';

import { Button } from '../components/ui';
import Text from '../components/AppText';
import HandGuide from '../components/mystic/HandGuide';
import MysticBackground from '../components/mystic/MysticBackground';
import MysticDivider from '../components/mystic/MysticDivider';
import PalmOracle from '../components/mystic/PalmOracle';
import { colors, font, radius, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';
import { useAnimatedValue } from '../lib/useAnimatedValue';
import { useReduceMotion } from '../lib/motion';

type SlideKind = 'hero' | 'ritual' | 'schools' | 'credits';

interface Slide {
  kind: SlideKind;
  tag: string;
  title: string;
  highlight?: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    kind: 'hero',
    tag: 'Khai Mở Thiên Cơ',
    title: 'Chụp lòng bàn tay.',
    highlight: 'AI đọc chỉ tay giúp bạn.',
    body: 'Chọn trường phái, chụp một tấm ảnh lòng bàn tay và nhận bài luận giải chi tiết trong chưa đầy một phút.',
  },
  {
    kind: 'ritual',
    tag: 'Nghi Thức Khai Mở',
    title: 'Ba bước kết nối',
    highlight: 'cổ thư tướng số.',
    body: 'PalmSight không đoán mò. Mỗi quẻ đi qua một nghi thức rõ ràng, từ ánh sáng đến đường chỉ.',
  },
  {
    kind: 'schools',
    tag: 'Tam Đại Huyền Phái',
    title: 'Ba trường phái,',
    highlight: 'một bàn tay.',
    body: 'Cùng một bàn tay, mỗi trường phái có một hệ quy chiếu riêng. Chọn cách bạn muốn lắng nghe.',
  },
  {
    kind: 'credits',
    tag: 'Linh Thạch Năng Lượng',
    title: 'Credits không hết hạn.',
    highlight: 'Mỗi quẻ, một lần mở.',
    body: 'Sẵn sàng lắng nghe thông điệp từ những đường chỉ tay của bạn?',
  },
];

const SCHOOL_GLYPHS: Record<string, string> = {
  WESTERN: '☼',
  EASTERN: '☯',
  VEDIC: '✦',
};

const RITUAL_STEPS = [
  { title: 'Chọn trường phái', body: 'Phương Tây, phương Đông hoặc Ấn Độ — tùy hệ quy chiếu bạn tin.' },
  { title: 'Chụp lòng bàn tay', body: 'Camera hoặc ảnh có sẵn. AI tự tìm lòng bàn tay và căn sáng.' },
  { title: 'Nhận luận giải', body: 'Bài bói chi tiết cùng ảnh vẽ ba đường Sinh · Trí · Tâm đạo.' },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const reduceMotion = useReduceMotion();
  const last = index === SLIDES.length - 1;

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
    if (clamped !== index) haptic.select();
    setIndex(clamped);
    listRef.current?.scrollToIndex({ index: clamped, animated: !reduceMotion });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <MysticBackground />

      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: font.display, fontSize: 24, letterSpacing: 1.5, color: colors.goldLight }}>PALMSIGHT</Text>
          <Text style={[type.eyebrow, { color: colors.stone, letterSpacing: 2.6 }]}>HUYỀN CƠ CHỈ TAY</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bỏ qua, đến đăng nhập"
          onPress={() => router.push('/login')}
          hitSlop={12}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
          <Text style={[type.captionStrong, { color: colors.gold }]}>Bỏ qua</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const position = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
          setIndex(Math.max(0, Math.min(SLIDES.length - 1, position)));
        }}
        getItemLayout={(_, position) => ({ length: width, offset: width * position, index: position })}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.index * width, animated: !reduceMotion });
        }}
        keyExtractor={(slide) => slide.tag}
        renderItem={({ item, index: position }) => (
          <View
            style={{ width, flex: 1 }}
            accessibilityElementsHidden={position !== index}
            importantForAccessibility={position === index ? 'yes' : 'no-hide-descendants'}
            aria-hidden={position !== index}>
            <SlideBody slide={item} active={position === index} width={width} />
          </View>
        )}
      />

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Trang ${index + 1} trên ${SLIDES.length}`}
          accessibilityValue={{ min: 1, max: SLIDES.length, now: index + 1 }}
          accessibilityActions={[
            { name: 'increment', label: 'Trang sau' },
            { name: 'decrement', label: 'Trang trước' },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') goTo(index + 1);
            if (event.nativeEvent.actionName === 'decrement') goTo(index - 1);
          }}
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, minHeight: 8, alignItems: 'center' }}>
          {SLIDES.map((slide, position) => (
            <View
              key={slide.tag}
              style={{
                width: position === index ? 30 : 8,
                height: 3,
                borderRadius: 999,
                backgroundColor: position === index ? colors.gold : colors.container,
              }}
            />
          ))}
        </View>

        {last ? (
          <View style={{ gap: spacing.sm }}>
            <Button label="Bói thử miễn phí (khách)" onPress={() => router.push('/guest')} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button label="Đăng ký" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/register')} />
              <Button label="Đăng nhập" variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/login')} />
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Button label="Tiếp tục" onPress={() => goTo(index + 1)} />
          </View>
        )}
      </View>
    </View>
  );
}

function SlideBody({ slide, active, width }: { slide: Slide; active: boolean; width: number }) {
  const entrance = useAnimatedValue(active ? 1 : 0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      entrance.setValue(active ? 1 : 0);
      return;
    }
    Animated.timing(entrance, {
      toValue: active ? 1 : 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, entrance, reduceMotion]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        gap: spacing.lg,
      }}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}>
      <Animated.View
        style={{
          gap: spacing.lg,
          opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }}>
        {slide.kind === 'hero' ? <HeroSlide slide={slide} width={width} /> : null}
        {slide.kind === 'ritual' ? <RitualSlide slide={slide} /> : null}
        {slide.kind === 'schools' ? <SchoolsSlide slide={slide} /> : null}
        {slide.kind === 'credits' ? <CreditsSlide slide={slide} /> : null}
      </Animated.View>
    </ScrollView>
  );
}

function SlideHeading({ slide }: { slide: Slide }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[type.eyebrow, { color: colors.gold, letterSpacing: 2.6 }]}>{`✦ ${slide.tag.toUpperCase()}`}</Text>
      <Text style={[type.displayXl, { color: colors.ink }]} accessibilityRole="header">
        {slide.title}
        {slide.highlight ? <Text style={{ color: colors.gold, fontFamily: font.displayItalic }}>{` ${slide.highlight}`}</Text> : null}
      </Text>
      <Text style={[type.bodyMd, { color: colors.mute }]}>{slide.body}</Text>
    </View>
  );
}

function HeroSlide({ slide, width }: { slide: Slide; width: number }) {
  return (
    <>
      <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: colors.hairlineStrong,
            borderRadius: radius.full,
            backgroundColor: colors.goldWash,
            paddingHorizontal: spacing.md,
            paddingVertical: 6,
          }}>
          <Text style={{ color: colors.gold, fontSize: 12 }}>✦</Text>
          <Text style={[type.captionStrong, { color: colors.goldLight, letterSpacing: 1.2 }]}>KHAI MỞ THIÊN CƠ · MIỄN PHÍ 3 CREDITS</Text>
        </View>

        <View style={{ marginTop: spacing.xs }}>
          <PalmOracle size={Math.min(width * 0.58, 238)} />
        </View>
      </View>

      <View style={{ gap: spacing.md, alignItems: 'center' }}>
        <MysticDivider compact />
        <Text style={[type.displayXl, { color: colors.ink, textAlign: 'center' }]} accessibilityRole="header">
          {slide.title}
          {'\n'}
          <Text style={{ color: colors.gold, fontFamily: font.displayItalic }}>{slide.highlight}</Text>
        </Text>
        <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center', maxWidth: 340 }]}>{slide.body}</Text>
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          paddingTop: spacing.md,
          alignItems: 'center',
        }}>
        <Text style={[type.code, { color: colors.stone, letterSpacing: 1.3, textAlign: 'center' }]}>
          3 CỔ PHÁI · &lt;60 GIÂY · 100% ẨN DANH
        </Text>
      </View>
    </>
  );
}

function RitualSlide({ slide }: { slide: Slide }) {
  return (
    <>
      <SlideHeading slide={slide} />

      <View
        style={{
          borderRadius: radius['3xl'],
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.hairline,
          backgroundColor: 'rgba(11,7,22,0.6)',
          padding: spacing.sm,
        }}>
        <HandGuide height={158} />
      </View>

      <View style={{ gap: spacing.sm }}>
        {RITUAL_STEPS.map((step, index) => (
          <View key={step.title} style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ alignItems: 'center', width: 30 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.gold,
                  backgroundColor: colors.goldWash,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={[type.monoStrong, { color: colors.gold }]}>{`0${index + 1}`}</Text>
              </View>
              {index < RITUAL_STEPS.length - 1 ? (
                <View style={{ width: 1, flex: 1, minHeight: 28, backgroundColor: colors.hairlineSoft, marginTop: 4 }} />
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 2, paddingBottom: spacing.sm }}>
              <Text style={[type.bodyBold, { color: colors.ink }]}>{step.title}</Text>
              <Text style={[type.caption, { color: colors.mute }]}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

function SchoolsSlide({ slide }: { slide: Slide }) {
  return (
    <>
      <SlideHeading slide={slide} />

      <View style={{ gap: spacing.sm }}>
        {READING_SCHOOL_LIST.map((school, index) => (
          <LinearGradient
            key={school.id}
            colors={['rgba(31,20,56,0.9)', 'rgba(19,12,36,0.94)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderWidth: 1,
              borderColor: index === 0 ? colors.hairlineStrong : colors.hairline,
              borderRadius: radius.xl,
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.gold,
                backgroundColor: colors.goldWash,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontFamily: font.display, fontSize: 24, color: colors.goldLight }}>{SCHOOL_GLYPHS[school.id] ?? '✦'}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyBold, { color: colors.ink }]}>{school.name}</Text>
              <Text style={[type.caption, { color: colors.mute }]} numberOfLines={2}>
                {school.description}
              </Text>
            </View>
            <Text style={[type.code, { color: colors.stone }]}>{`0${index + 1}`}</Text>
          </LinearGradient>
        ))}
      </View>

      <MysticDivider compact symbol="☽ ✦ ☾" />
    </>
  );
}

function CreditsSlide({ slide }: { slide: Slide }) {
  return (
    <>
      <SlideHeading slide={slide} />

      <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
        <View style={{ width: 170, height: 170, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              width: 164,
              height: 164,
              borderRadius: 999,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.hairlineStrong,
            }}
          />
          <LinearGradient
            colors={['#f7e7b4', '#d4af37', '#9a7b2c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 126, height: 126, borderRadius: 999, padding: 1.5 }}>
            <View
              style={{
                flex: 1,
                borderRadius: 999,
                backgroundColor: colors.canvas,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}>
              <Text style={{ fontFamily: font.displayStrong, fontSize: 48, lineHeight: 52, color: colors.gold }}>3</Text>
              <Text style={[type.eyebrow, { color: colors.goldLight, letterSpacing: 2.4 }]}>CREDITS</Text>
            </View>
          </LinearGradient>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        {[
          '3 credits sau khi xác thực email',
          '+2 credits mỗi khi có người nhập mã giới thiệu của bạn',
          '1 lần xem = 1 credit, dù chọn bao nhiêu mục',
        ].map((item) => (
          <View key={item} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <Text style={{ color: colors.gold, fontSize: 12, lineHeight: 22 }}>✦</Text>
            <Text style={[type.bodyMd, { color: colors.body, flex: 1 }]}>{item}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
