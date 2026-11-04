import React, { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { HandOrientation, LIFE_ASPECTS, READING_SCHOOL_LIST } from '@palmsight/shared';

import Text from './AppText';
import HandChoice from './HandChoice';
import { Banner, Button, Chip, RadioCard, SectionLabel } from './ui';
import { colors, radius, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';
import { handLabel } from '../lib/format';
import { useAuth } from '../state/auth';
import { useReadingDraft } from '../state/readingDraft';
import { useReduceMotion } from '../lib/motion';
import { useAnimatedValue } from '../lib/useAnimatedValue';

const STEPS = [
  { title: 'Trường phái', short: 'Cổ phái' },
  { title: 'Mục muốn bói', short: 'Mục bói' },
  { title: 'Bàn tay', short: 'Bàn tay' },
] as const;

const SCHOOL_GLYPHS: Record<string, string> = { WESTERN: '☼', EASTERN: '☯', VEDIC: '✦' };

interface ReadingSetupSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Chuyển sang phòng quét sau khi chốt lựa chọn. */
  onStartScan: () => void;
}

export default function ReadingSetupSheet({ visible, onClose, onStartScan }: ReadingSetupSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user } = useAuth();
  const draft = useReadingDraft();
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState(0);
  // Yoga không tự tính chiều cao cho `flex: 1` khi cha chỉ có maxHeight, nên sheet phải có height rõ ràng.
  const sheetMax = Math.round(height * 0.9);
  // Bước 1 tràn ngập chip nên cần gần hết màn hình; hai bước còn lại ít nội dung hơn nhiều.
  const sheetHeight = step === 1 ? sheetMax : Math.round(height * 0.7);
  // Dịch chuyển dùng sheetMax (không đổi theo step) để đổi bước không phát lại animation mở sheet.
  const translateY = useAnimatedValue(sheetMax);
  const backdrop = useAnimatedValue(0);

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      translateY.setValue(0);
      backdrop.setValue(1);
      return;
    }
    translateY.setValue(sheetMax);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 24, stiffness: 220, mass: 0.9, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [backdrop, reduceMotion, sheetMax, translateY, visible]);

  function close() {
    if (reduceMotion) {
      setStep(0);
      onClose();
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, { toValue: sheetMax, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      setStep(0);
      onClose();
    });
  }

  function next() {
    haptic.tap();
    if (step === STEPS.length - 1) {
      close();
      setTimeout(onStartScan, 120);
      return;
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  const canContinue = step !== 1 || draft.selected.length > 0;
  const summary = `${draft.schoolConfig.name} · ${handLabel(draft.hand)} · ${draft.selected.length}/${draft.allTopics.length} mục`;
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close} onShow={() => setStep(0)} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ ...absoluteFill, backgroundColor: colors.scrim, opacity: backdrop }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng thiết lập" onPress={close} style={{ flex: 1 }} />
        </Animated.View>

        <Animated.View
          style={{
            height: sheetHeight,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.glassBorder,
            backgroundColor: colors.cardGlassDeep,
            transform: [{ translateY }],
            overflow: 'hidden',
          }}>
          <LinearGradient colors={['rgba(124,108,246,0.16)', 'rgba(8,13,30,0.96)']} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg, paddingHorizontal: spacing.xl }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.eyebrow, { color: colors.gold }]}>THIẾT LẬP QUẺ</Text>
                <Text style={[type.headingMd, { color: colors.ink }]}>{STEPS[step].title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                onPress={close}
                hitSlop={8}
                style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassFill }}>
                <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
              {STEPS.map((item, position) => {
                const unavailable = position > 1 && draft.selected.length === 0;
                return (
                  <Pressable
                    key={item.title}
                    accessibilityRole="tab"
                    accessibilityLabel={item.title}
                    accessibilityState={{ selected: position === step, disabled: unavailable }}
                    aria-selected={position === step}
                    aria-disabled={unavailable}
                    disabled={unavailable}
                    onPress={() => {
                      haptic.select();
                      setStep(position);
                    }}
                    style={{ flex: 1, gap: 4, minHeight: 44, justifyContent: 'center', opacity: unavailable ? 0.4 : 1 }}>
                    <View style={{ height: 3, borderRadius: 2, backgroundColor: position <= step ? colors.gold : colors.glassBorder }} />
                    <Text style={[type.captionStrong, { color: position === step ? colors.goldLight : colors.stone, fontSize: 11 }]} numberOfLines={1}>
                      {item.short}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {step === 0 ? (
                <View accessibilityRole="radiogroup" accessibilityLabel="Chọn trường phái" style={{ gap: spacing.sm }}>
                  {READING_SCHOOL_LIST.map((config) => (
                    <RadioCard
                      key={config.id}
                      label={config.name}
                      description={config.description}
                      glyph={SCHOOL_GLYPHS[config.id]}
                      selected={config.id === draft.school}
                      onPress={() => {
                        haptic.select();
                        draft.pickSchool(config.id);
                      }}
                    />
                  ))}
                </View>
              ) : null}

              {step === 1 ? (
                <View style={{ gap: spacing.md }}>
                  <Chip label="Bói toàn bộ" selected={draft.selected.length === draft.allTopics.length} onPress={() => { haptic.select(); draft.toggleAll(); }} style={{ alignSelf: 'flex-start' }} />
                  <TopicGroup
                    label="ĐƯỜNG CHỈ & DẤU HIỆU"
                    items={draft.schoolConfig.sections.map((section) => ({ key: section.key, label: section.label }))}
                    selected={draft.selected}
                    onToggle={draft.toggleTopic}
                  />
                  <TopicGroup
                    label="KHÍA CẠNH CUỘC SỐNG"
                    items={LIFE_ASPECTS.map((aspect) => ({ key: aspect.key, label: aspect.label }))}
                    selected={draft.selected}
                    onToggle={draft.toggleTopic}
                  />
                </View>
              ) : null}

              {step === 2 ? (
                <View style={{ gap: spacing.lg }}>
                  <View accessibilityRole="radiogroup" accessibilityLabel="Chọn tay" style={{ flexDirection: 'row', gap: spacing.md }}>
                    {[HandOrientation.LEFT, HandOrientation.RIGHT].map((side) => (
                      <HandChoice
                        key={side}
                        side={side}
                        selected={draft.hand === side}
                        onPress={() => {
                          haptic.select();
                          draft.setHand(side);
                        }}
                      />
                    ))}
                  </View>
                  {draft.schoolConfig.handHint ? <Text style={[type.caption, { color: colors.stone }]}>{draft.schoolConfig.handHint}</Text> : null}

                  <View style={{ borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.xl, backgroundColor: colors.goldWash, padding: spacing.md, gap: 6, flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="star-four-points" size={16} color={colors.gold} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[type.captionStrong, { color: colors.goldLight }]}>1 credit cho mỗi quẻ</Text>
                      <Text style={[type.caption, { color: colors.mute }]}>{summary}</Text>
                    </View>
                  </View>

                  {user && user.creditBalance <= 0 ? (
                    <Banner
                      variant="warning"
                      title="Bạn đã dùng hết credits"
                      lines={['Mời bạn bè hoặc nhập mã giới thiệu để nhận thêm credits.']}
                      action={{
                        label: 'Mở Hồ sơ',
                        onPress: () => {
                          close();
                          setTimeout(() => router.push('/profile'), 120);
                        },
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
            </ScrollView>

            <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.glassBorder }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {step > 0 ? <Button label="Quay lại" variant="ghost" style={{ flex: 1 }} onPress={() => { haptic.tap(); setStep((current) => current - 1); }} /> : null}
                <Button
                  label={step === STEPS.length - 1 ? 'Chụp bàn tay' : 'Tiếp tục'}
                  style={{ flex: step > 0 ? 2 : 1 }}
                  onPress={next}
                  disabled={!canContinue}
                  icon={<MaterialCommunityIcons name={step === STEPS.length - 1 ? 'camera-iris' : 'arrow-right'} size={18} color={colors.onGold} />}
                />
              </View>
              <Text style={[type.caption, { color: step === 1 && draft.selected.length === 0 ? colors.danger : colors.stone, textAlign: 'center' }]}>
                {step === 1 && draft.selected.length === 0
                  ? 'Chọn ít nhất 1 mục để tiếp tục.'
                  : step === 2
                    ? 'Bạn sẽ chụp ảnh lòng bàn tay ở bước tiếp theo.'
                    : 'Mọi lựa chọn có thể thay đổi trong phòng quét.'}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

function TopicGroup({ label, items, selected, onToggle }: { label: string; items: { key: string; label: string }[]; selected: string[]; onToggle: (key: string) => void }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel>{label}</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {items.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            selected={selected.includes(item.key)}
            onPress={() => {
              haptic.select();
              onToggle(item.key);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
