import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, View, type ScrollViewInstance } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  HandOrientation,
  LIFE_ASPECTS,
  ReadingSchool,
  ReadingStatus,
  READING_SCHOOL_LIST,
  getAllSchoolTopics,
  type ReadingSchoolConfig,
} from '@palmsight/shared';

import HeaderCredits from '../../components/HeaderCredits';
import HandChoice from '../../components/HandChoice';
import RitualStepper, { StepCard } from '../../components/RitualSteps';
import Screen, { ScreenHeader } from '../../components/Screen';
import Text from '../../components/AppText';
import { Banner, Button, Checkbox, Chip, LoadingOverlay, RadioCard, SectionLabel } from '../../components/ui';
import HandGuide from '../../components/mystic/HandGuide';
import MysticDivider from '../../components/mystic/MysticDivider';
import { ApiError } from '../../lib/api';
import { errorMessageOf } from '../../lib/forms';
import { haptic } from '../../lib/haptics';
import { useAnimatedValue } from '../../lib/useAnimatedValue';
import { useReduceMotion } from '../../lib/motion';
import { handLabel, topicsLabel } from '../../lib/format';
import { getLastSchool, setLastSchool } from '../../lib/preferences';
import { createReading, fetchReading } from '../../lib/readings';
import { newIdempotencyKey } from '../../lib/uuid';
import { useAuth } from '../../state/auth';
import { useCapture } from '../../state/capture';
import { colors, radius, spacing, text as type } from '../../theme';

const STEPS = [
  { index: 1, title: 'Trường phái', tag: 'Huyền Học', short: 'Cổ phái' },
  { index: 2, title: 'Mục muốn bói', tag: 'Quẻ Mệnh', short: 'Mục bói' },
  { index: 3, title: 'Tay', tag: 'Âm Dương', short: 'Bàn tay' },
  { index: 4, title: 'Chụp ảnh', tag: 'Ấn Tướng', short: 'Ấn tướng' },
] as const;

const SCHOOL_GLYPHS: Record<string, string> = {
  WESTERN: '☼',
  EASTERN: '☯',
  VEDIC: '✦',
};

// Web đặt mốc 45s cho thanh tiến trình vì AI luận giải đồng bộ phía server
const PROGRESS_SECONDS = 45;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

export default function ScanScreen() {
  const { user, refreshUser } = useAuth();
  const { photo, submitPhoto, clearPhoto } = useCapture();

  const scrollRef = useRef<ScrollViewInstance>(null);
  const cancelRef = useRef(false);
  const [step, setStep] = useState(1);
  const [school, setSchool] = useState<ReadingSchool>(ReadingSchool.EASTERN);
  const [selected, setSelected] = useState<string[]>([]);
  const [hand, setHand] = useState<HandOrientation>(HandOrientation.LEFT);
  const [aiConsent, setAiConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [failure, setFailure] = useState<{ title: string; lines?: string[]; retryable: boolean } | null>(null);
  const reduceMotion = useReduceMotion();
  const stepAnim = useAnimatedValue(1);

  const currentStep = STEPS[step - 1];
  const schoolConfig: ReadingSchoolConfig = useMemo(
    () => READING_SCHOOL_LIST.find((config) => config.id === school) ?? READING_SCHOOL_LIST[0],
    [school]
  );
  const allTopics = useMemo(() => getAllSchoolTopics(school), [school]);
  const topics = selected;
  const creditBalance = user?.creditBalance ?? 0;

  useEffect(() => {
    void getLastSchool().then((stored) => {
      setSchool(stored);
      setSelected(getAllSchoolTopics(stored));
    });
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed((second) => second + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [step]);

  useEffect(() => {
    if (reduceMotion) {
      stepAnim.setValue(1);
      return;
    }
    stepAnim.setValue(0);
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, stepAnim, reduceMotion]);

  function pickSchool(next: ReadingSchool) {
    haptic.select();
    const nextConfig = READING_SCHOOL_LIST.find((config) => config.id === next) ?? READING_SCHOOL_LIST[0];
    const nextKeys = new Set<string>([
      ...nextConfig.sections.map((section) => section.key),
      ...LIFE_ASPECTS.map((aspect) => aspect.key),
    ]);
    // Đổi trường phái chỉ bỏ các mục riêng của trường phái cũ, giữ khía cạnh cuộc sống đã chọn
    setSchool(next);
    setSelected((current) => current.filter((key) => nextKeys.has(key)));
    void setLastSchool(next);
    setFailure(null);
  }

  function toggleTopic(key: string) {
    haptic.select();
    setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function toggleAll() {
    setSelected(selected.length === allTopics.length ? [] : allTopics);
  }

  async function pickFromGallery() {
    setFailure(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFailure({ title: 'Không thể truy cập thư viện ảnh. Vui lòng cấp quyền hoặc dùng camera.', retryable: false });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    submitPhoto({ uri: result.assets[0].uri, name: `palm-${Date.now()}.jpg`, type: 'image/jpeg' });
  }

  async function submit() {
    if (!photo) return;
    cancelRef.current = false;
    setElapsed(0);
    setBusy(true);
    setCancelled(false);
    setFailure(null);
    try {
      const created = await createReading({
        school,
        hand,
        topics,
        aiConsent,
        image: photo,
        idempotencyKey: newIdempotencyKey(),
      });

      let reading = created.reading;
      if (reading.status === ReadingStatus.PROCESSING) {
        reading = await waitForReading(reading.id, () => cancelRef.current);
      }

      // Người dùng đã rời màn chờ: quẻ vẫn xử lý phía server, không tự mở kết quả nữa
      if (cancelRef.current) return;

      // /me là nguồn số dư đúng nhất sau khi trừ hoặc hoàn credit
      await refreshUser();

      if (reading.status === ReadingStatus.REJECTED || reading.status === ReadingStatus.FAILED) {
        haptic.warning();
        setFailure(outcomeFailure(reading.status, reading.rejectReason));
        return;
      }

      haptic.success();
      clearPhoto();
      router.push({ pathname: '/reading/[id]', params: { id: reading.id } });
    } catch (error) {
      if (cancelRef.current) return;
      haptic.warning();
      setFailure(toFailure(error));
      void refreshUser().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  // Hủy màn chờ: dừng polling ở client. Quẻ đã gửi vẫn chạy hết phía server và
  // credit chỉ trừ khi thành công — người dùng tìm lại trong Lịch sử.
  function cancelWait() {
    cancelRef.current = true;
    haptic.warning();
    setBusy(false);
    setElapsed(0);
    setCancelled(true);
  }

  const canContinue = step !== 2 || selected.length > 0;
  const submitDisabled = !photo || creditBalance <= 0 || !aiConsent;
  const disabledReason =
    step === 2 && selected.length === 0
      ? 'Chọn ít nhất 1 mục để tiếp tục.'
      : step === 4
        ? !photo
          ? 'Chụp hoặc chọn ảnh lòng bàn tay để tiếp tục.'
          : !aiConsent
            ? 'Bạn cần đồng ý gửi ảnh cho AI phân tích.'
            : creditBalance <= 0
              ? 'Bạn cần thêm credit để xem bói.'
              : null
        : null;

  function goToStep(next: number) {
    haptic.tap();
    setFailure(null);
    const clamped = Math.max(1, Math.min(STEPS.length, next));
    // Stepper cho phép nhảy bước; vẫn phải có ít nhất 1 mục bói trước khi qua bước 2.
    if (clamped > 2 && selected.length === 0) {
      setStep(2);
      return;
    }
    setStep(clamped);
  }

  return (
    <>
      <Screen
        scrollRef={scrollRef}
        header={
          <View style={{ gap: spacing.lg }}>
            <ScreenHeader
              eyebrow="Đài Chiêm Tinh"
              title="Khởi tạo Quẻ Bói Chỉ Tay"
              subtitle="Chọn trường phái, mục muốn bói rồi chụp ảnh lòng bàn tay."
              right={<HeaderCredits />}
            />
            <RitualStepper steps={STEPS} step={step} onSelect={goToStep} />
          </View>
        }
        footer={
          <View style={{ gap: spacing.sm }}>
            <Text
              accessibilityLiveRegion="polite"
              style={[type.caption, { color: failure ? colors.danger : colors.mute, textAlign: 'center', minHeight: 19 }]}>
              {disabledReason ?? failure?.title ?? ' '}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {step > 1 ? (
                <Button label="Quay lại" variant="ghost" style={{ flex: 1 }} onPress={() => goToStep(step - 1)} />
              ) : null}
              <Button
                label={step < STEPS.length ? 'Tiếp tục' : 'Xem bói (−1 credit)'}
                style={{ flex: step > 1 ? 2 : 1 }}
                onPress={step < STEPS.length ? () => goToStep(step + 1) : submit}
                loading={step === STEPS.length ? busy : false}
                disabled={step === STEPS.length ? submitDisabled : !canContinue}
              />
            </View>
          </View>
        }>
        {creditBalance <= 0 ? (
          <Banner
            variant="error"
            title="Hết credits"
            lines={
              user?.referral.canEnterCode
                ? ['Mời bạn bè nhập mã để nhận 2 credits. Có mã của bạn bè? Nhập để nhận 1 credit.']
                : ['Mời bạn bè nhập mã để nhận 2 credits.']
            }
            action={{
              label: user?.referral.canEnterCode ? 'Nhập mã giới thiệu' : 'Trang giới thiệu',
              onPress: () => router.push(user?.referral.canEnterCode ? '/enter-referral' : '/referral'),
            }}
          />
        ) : null}

        <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs }}>
          <MysticDivider compact symbol="✦ ☽ ☾" />
          <Text style={[type.quote, { color: colors.goldLight, textAlign: 'center' }]}>“Mỗi bàn tay giữ một thiên mệnh.”</Text>
        </View>

        <StepCard step={currentStep} total={STEPS.length}>
          <Animated.View
            style={{
              gap: spacing.md,
              opacity: stepAnim,
              transform: [{ translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}>
            {currentStep.index === 1 ? (
              <View accessibilityRole="radiogroup" accessibilityLabel="Chọn trường phái" style={{ gap: spacing.sm }}>
                {READING_SCHOOL_LIST.map((config) => (
                  <RadioCard
                    key={config.id}
                    label={config.name}
                    description={config.description}
                    glyph={SCHOOL_GLYPHS[config.id]}
                    selected={config.id === school}
                    onPress={() => pickSchool(config.id)}
                  />
                ))}
              </View>
            ) : null}

            {currentStep.index === 2 ? (
              <View style={{ gap: spacing.md }}>
                <Chip label="Bói toàn bộ" selected={selected.length === allTopics.length} onPress={toggleAll} style={{ alignSelf: 'flex-start' }} />

                <TopicGroup label="ĐƯỜNG CHỈ & DẤU HIỆU" items={schoolConfig.sections.map((section) => ({ key: section.key, label: section.label }))} selected={selected} onToggle={toggleTopic} />
                <TopicGroup label="KHÍA CẠNH CUỘC SỐNG" items={LIFE_ASPECTS.map((aspect) => ({ key: aspect.key, label: aspect.label }))} selected={selected} onToggle={toggleTopic} />

                {selected.length === 0 ? (
                  <Text style={[type.caption, { color: colors.danger }]}>Chọn ít nhất 1 mục</Text>
                ) : null}
              </View>
            ) : null}

            {currentStep.index === 3 ? (
              <View style={{ gap: spacing.md }}>
                <View accessibilityRole="radiogroup" accessibilityLabel="Chọn tay" style={{ flexDirection: 'row', gap: spacing.md }}>
                  {[HandOrientation.LEFT, HandOrientation.RIGHT].map((side) => (
                    <HandChoice
                      key={side}
                      side={side}
                      selected={hand === side}
                      onPress={() => {
                        haptic.select();
                        setHand(side);
                      }}
                    />
                  ))}
                </View>
                {schoolConfig.handHint ? (
                  <Text style={[type.caption, { color: colors.stone }]}>{schoolConfig.handHint}</Text>
                ) : null}
                <Text style={[type.caption, { color: colors.stone }]}>Giá 1 credit, dù chọn bao nhiêu mục</Text>
              </View>
            ) : null}

            {currentStep.index === 4 ? (
              <View style={{ gap: spacing.md }}>
                <Chip label={`${schoolConfig.name} · ${handLabel(hand)} · ${topicsLabel(topics, school)}`} style={{ alignSelf: 'flex-start' }} />

                {photo ? (
                  <View
                    style={{
                      borderRadius: radius['2xl'],
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: colors.hairlineStrong,
                      backgroundColor: colors.obsidian,
                    }}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={{ width: '100%', height: 260, backgroundColor: colors.obsidian }}
                      resizeMode="contain"
                      accessibilityLabel="Ảnh lòng bàn tay đã chọn"
                    />
                    <View
                      style={{
                        position: 'absolute',
                        top: spacing.md,
                        right: spacing.md,
                        borderRadius: radius.full,
                        borderWidth: 1,
                        borderColor: colors.gold,
                        backgroundColor: 'rgba(11,7,22,0.82)',
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 4,
                      }}>
                      <Text style={[type.code, { color: colors.goldLight }]}>✓ ĐÃ CHỌN</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={clearPhoto}
                      style={{ padding: spacing.md, backgroundColor: 'rgba(20,13,38,0.94)', minHeight: 44, justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.hairline }}>
                      <Text style={[type.bodyBold, { color: colors.gold, textAlign: 'center' }]}>Chụp lại / Chọn lại</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: spacing.sm }}>
                    <HandGuide height={240} />
                    <Text style={[type.caption, { color: colors.mute, textAlign: 'center' }]}>
                      Đủ sáng, xòe ngón tay, lòng bàn tay hướng thẳng camera.
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Button
                    label="Bật camera"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() => {
                      router.push('/camera');
                    }}
                  />
                  <Button label="Chọn ảnh" variant="ghost" style={{ flex: 1 }} onPress={pickFromGallery} />
                </View>

                <Checkbox label="Tôi đồng ý gửi ảnh lòng bàn tay cho hệ thống AI phân tích" checked={aiConsent} onChange={setAiConsent} />
              </View>
            ) : null}
          </Animated.View>
        </StepCard>

        {failure ? (
          <Banner
            variant="error"
            title={failure.title}
            lines={failure.lines}
            action={failure.retryable ? { label: 'Thử lại', onPress: submit } : undefined}
          />
        ) : null}

        {cancelled ? (
          <Banner
            variant="info"
            title="Đã hủy màn chờ kết quả."
            lines={['Quẻ vẫn đang được xử lý phía hệ thống — kiểm tra lại trong Lịch sử sau ít phút.']}
            action={{ label: 'Mở Lịch sử', onPress: () => router.push('/history') }}
          />
        ) : null}
      </Screen>

      <LoadingOverlay
        visible={busy}
        title="Thiên Cơ Luận Giải"
        message="PalmSight đang đọc từng đường chỉ tay và viết bài luận giải riêng cho bạn."
        progress={Math.min(elapsed / PROGRESS_SECONDS, 1)}
        photoUri={photo?.uri}
        onCancel={cancelWait}
        cancelLabel="Hủy chờ kết quả">
        <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
          {`Đã trôi qua ${Math.min(elapsed, PROGRESS_SECONDS)} giây · ảnh chỉ dùng cho lần xem này.`}
        </Text>
      </LoadingOverlay>
    </>
  );
}

function TopicGroup({ label, items, selected, onToggle }: { label: string; items: { key: string; label: string }[]; selected: string[]; onToggle: (key: string) => void }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel>{label}</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {items.map((item) => (
          <Chip key={item.key} label={item.label} selected={selected.includes(item.key)} onPress={() => onToggle(item.key)} />
        ))}
      </View>
    </View>
  );
}

async function waitForReading(id: string, shouldStop: () => boolean) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let current = await fetchReading(id);
  while (current.status === ReadingStatus.PROCESSING && Date.now() < deadline && !shouldStop()) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    current = await fetchReading(id);
  }
  return current;
}

function outcomeFailure(status: ReadingStatus, rejectReason?: string | null) {
  if (status === ReadingStatus.REJECTED) {
    return {
      title: 'Không nhìn rõ lòng bàn tay',
      lines: [rejectReason || 'Hãy chụp lại nơi đủ sáng, xoè thẳng bàn tay.', 'Đã hoàn 1 credit'],
      retryable: false,
    };
  }
  return { title: 'Hệ thống bận, đã hoàn 1 credit. Thử lại sau ít phút.', retryable: true };
}

function toFailure(error: unknown): { title: string; lines?: string[]; retryable: boolean } {
  if (error instanceof ApiError) {
    if (error.code === 'INSUFFICIENT_CREDITS') return { title: 'Hết credits', lines: ['Mời bạn bè nhập mã để nhận 2 credits.'], retryable: false };
    if (error.code === 'AI_UNAVAILABLE') return { title: 'Hệ thống bận, đã hoàn 1 credit. Thử lại sau ít phút.', retryable: true };
    if (error.status === 0) return { title: 'Mất kết nối hoặc quá thời gian chờ.', retryable: true };
    return { title: errorMessageOf(error), retryable: error.status >= 500 };
  }
  return { title: errorMessageOf(error), retryable: false };
}
