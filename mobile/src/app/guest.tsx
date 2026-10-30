import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Text, View, type ScrollViewInstance } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  HandOrientation,
  ReadingSchool,
  ReadingStatus,
  READING_SCHOOL_LIST,
  getAllSchoolTopics,
  type ReadingSchoolConfig,
} from '@palmsight/shared';

import Screen, { ScreenHeader } from '../components/Screen';
import HandChoice from '../components/HandChoice';
import HandGuide from '../components/mystic/HandGuide';
import RitualStepper, { StepCard, type RitualStep } from '../components/RitualSteps';
import { Banner, Button, Checkbox, Chip, LoadingOverlay, RadioCard, SectionLabel, TextLink } from '../components/ui';
import { ApiError } from '../lib/api';
import { errorMessageOf } from '../lib/forms';
import { getGuestFingerprint } from '../lib/fingerprint';
import { haptic } from '../lib/haptics';
import { handLabel, topicsLabel } from '../lib/format';
import { getLastSchool, setLastSchool } from '../lib/preferences';
import { createGuestReading } from '../lib/readings';
import { newIdempotencyKey } from '../lib/uuid';
import { useReduceMotion } from '../lib/motion';
import { useCapture } from '../state/capture';
import { colors, radius, spacing, text as type } from '../theme';

// Web đặt mốc 45s cho thanh tiến trình vì AI luận giải đồng bộ phía server
const PROGRESS_SECONDS = 45;

const SCHOOL_GLYPHS: Record<string, string> = {
  WESTERN: '☼',
  EASTERN: '☯',
  VEDIC: '✦',
};

const GUEST_STEPS: readonly RitualStep[] = [
  { index: 1, title: 'Chọn trường phái', tag: 'Huyền Học', short: 'Cổ phái' },
  { index: 2, title: 'Tay & ấn tượng', tag: 'Âm Dương', short: 'Tay · Ảnh' },
  { index: 3, title: 'Xác nhận & khởi quẻ', tag: 'Khởi Quẻ', short: 'Xác nhận' },
];

export default function GuestScanScreen() {
  const { target, photo, submitPhoto, clearPhoto, setTarget } = useCapture();

  const [step, setStep] = useState(1);
  const [school, setSchool] = useState<ReadingSchool>(ReadingSchool.EASTERN);
  const [hand, setHand] = useState<HandOrientation>(HandOrientation.LEFT);
  const [aiConsent, setAiConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [failure, setFailure] = useState<{ title: string; lines?: string[]; action?: { label: string; onPress: () => void } } | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const reduceMotion = useReduceMotion();

  const schoolConfig: ReadingSchoolConfig = useMemo(
    () => READING_SCHOOL_LIST.find((config) => config.id === school) ?? READING_SCHOOL_LIST[0],
    [school]
  );
  // Guest bói toàn bộ mục của trường phái đã chọn (không cho chọn lọc như thành viên)
  const topics = useMemo(() => getAllSchoolTopics(school), [school]);

  // Ảnh trong context có thể còn của luồng thành viên — chỉ dùng khi nó dành cho guest
  const guestPhoto = target === 'guest' ? photo : null;
  const currentStep = GUEST_STEPS[step - 1];

  useEffect(() => {
    void getLastSchool().then(setSchool);
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed((second) => second + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
  }, [step, reduceMotion]);

  function pickSchool(next: ReadingSchool) {
    haptic.select();
    setSchool(next);
    void setLastSchool(next);
    setFailure(null);
  }

  function goToStep(next: number) {
    haptic.tap();
    setFailure(null);
    const clamped = Math.max(1, Math.min(GUEST_STEPS.length, next));
    // Bước xác nhận cần ảnh; thiếu ảnh thì đưa về bước chụp
    if (clamped >= 3 && !guestPhoto) {
      setStep(2);
      return;
    }
    setStep(clamped);
  }

  async function pickFromGallery() {
    setFailure(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFailure({ title: 'Không thể truy cập thư viện ảnh. Vui lòng cấp quyền hoặc dùng camera.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    submitPhoto({ uri: result.assets[0].uri, name: `palm-${Date.now()}.jpg`, type: 'image/jpeg' }, 'guest');
  }

  async function submit() {
    if (!guestPhoto) return;
    setElapsed(0);
    setBusy(true);
    setFailure(null);
    try {
      const fingerprint = await getGuestFingerprint();
      const created = await createGuestReading({
        school,
        hand,
        aiConsent,
        image: guestPhoto,
        fingerprint,
        idempotencyKey: newIdempotencyKey(),
      });

      const reading = created.reading;
      if (reading.status === ReadingStatus.REJECTED || reading.status === ReadingStatus.FAILED) {
        haptic.warning();
        setFailure({
          title: reading.status === ReadingStatus.REJECTED ? 'Không nhìn rõ lòng bàn tay' : 'Hệ thống đang bận, thử lại sau ít phút.',
          lines: [reading.rejectReason || 'Hãy chụp lại nơi đủ sáng, xoè thẳng bàn tay.'],
        });
        return;
      }

      const claimToken = created.claimToken || reading.claimToken;
      if (!claimToken) {
        haptic.warning();
        setFailure({ title: 'Không nhận được mã bài bói thử. Vui lòng thử lại.' });
        return;
      }
      haptic.success();
      router.replace({ pathname: '/guest-reading/[token]', params: { token: claimToken } });
    } catch (error) {
      haptic.warning();
      setFailure(toGuestFailure(error));
    } finally {
      setBusy(false);
    }
  }

  const disabledReason =
    step === 2 && !guestPhoto
      ? 'Chụp hoặc chọn ảnh lòng bàn tay để tiếp tục.'
      : step === 3 && !aiConsent
        ? 'Bạn cần đồng ý gửi ảnh cho AI phân tích.'
        : null;
  const canContinue = step !== 2 || Boolean(guestPhoto);
  const lastStep = step === GUEST_STEPS.length;

  return (
    <>
      <Screen
        scrollRef={scrollRef}
        header={
          <View style={{ gap: spacing.lg }}>
            <ScreenHeader
              eyebrow="Lượt Bói Thử Miễn Phí"
              title="Bói thử với tư cách khách"
              subtitle="Một lượt duy nhất cho mỗi thiết bị. Chọn trường phái, chụp lòng bàn tay và nhận bài bói ngay."
            />
            <RitualStepper steps={GUEST_STEPS} step={step} onSelect={goToStep} />
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
                label={lastStep ? (busy ? 'Đang luận giải...' : 'Xem bói thử (miễn phí)') : 'Tiếp tục'}
                style={{ flex: step > 1 ? 2 : 1 }}
                onPress={lastStep ? submit : () => goToStep(step + 1)}
                loading={lastStep ? busy : false}
                disabled={lastStep ? !guestPhoto || !aiConsent : !canContinue}
              />
            </View>
          </View>
        }>
        <StepCard step={currentStep} total={GUEST_STEPS.length}>
          {step === 1 ? (
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

          {step === 2 ? (
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.sm }}>
                <SectionLabel>ÂM DƯƠNG</SectionLabel>
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
              </View>

              <View style={{ gap: spacing.sm }}>
                <SectionLabel>ẤN TƯỢNG</SectionLabel>
                {guestPhoto ? (
                  <View style={{ borderRadius: radius['2xl'], overflow: 'hidden', borderWidth: 1, borderColor: colors.hairlineStrong }}>
                    <Image
                      source={{ uri: guestPhoto.uri }}
                      style={{ width: '100%', height: 230, backgroundColor: colors.obsidian }}
                      resizeMode="contain"
                      accessibilityLabel="Ảnh lòng bàn tay đã chọn"
                    />
                    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs, backgroundColor: 'rgba(20,13,38,0.94)' }}>
                      <TextLink label="Chụp lại / Chọn lại" onPress={clearPhoto} />
                    </View>
                  </View>
                ) : (
                  <>
                    <HandGuide height={220} />
                    <Text style={[type.caption, { color: colors.mute, textAlign: 'center' }]}>
                      Đủ sáng, xòe ngón tay, lòng bàn tay hướng thẳng camera.
                    </Text>
                  </>
                )}

                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Button
                    label="Bật camera"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() => {
                      setTarget('guest');
                      router.push('/camera');
                    }}
                  />
                  <Button label="Chọn ảnh" variant="ghost" style={{ flex: 1 }} onPress={pickFromGallery} />
                </View>
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={{ gap: spacing.md }}>
              <Chip label={`${schoolConfig.name} · ${handLabel(hand)} · ${topicsLabel(topics, school)}`} style={{ alignSelf: 'flex-start' }} />

              {guestPhoto ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Image
                    source={{ uri: guestPhoto.uri }}
                    style={{ width: 76, height: 96, borderRadius: radius.lg, backgroundColor: colors.obsidian }}
                    resizeMode="cover"
                    accessibilityLabel="Ảnh lòng bàn tay đã chọn"
                  />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={[type.bodyStrong, { color: colors.ink }]}>Ảnh lòng bàn tay</Text>
                    <Text style={[type.caption, { color: colors.mute }]}>Ảnh chỉ dùng cho lần xem bói này.</Text>
                    <TextLink label="Chụp lại / Chọn lại" onPress={() => goToStep(2)} />
                  </View>
                </View>
              ) : null}

              <View style={{ height: 1, backgroundColor: colors.hairlineSoft }} />
              <Checkbox label="Tôi đồng ý gửi ảnh lòng bàn tay cho hệ thống AI phân tích" checked={aiConsent} onChange={setAiConsent} />
              <Text style={[type.caption, { color: colors.stone }]}>
                Mỗi thiết bị chỉ có 1 lượt bói thử miễn phí. Không tiêu credit.
              </Text>
            </View>
          ) : null}
        </StepCard>

        {failure ? <Banner variant="error" title={failure.title} lines={failure.lines} action={failure.action} /> : null}
      </Screen>

      <LoadingOverlay
        visible={busy}
        title="Thiên Cơ Luận Giải"
        message="PalmSight đang đọc từng đường chỉ tay và viết bài luận giải riêng cho bạn."
        progress={Math.min(elapsed / PROGRESS_SECONDS, 1)}
        photoUri={guestPhoto?.uri}>
        <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
          {`Đã trôi qua ${Math.min(elapsed, PROGRESS_SECONDS)} giây · ảnh chỉ dùng cho lần xem này.`}
        </Text>
      </LoadingOverlay>
    </>
  );
}

function toGuestFailure(error: unknown): { title: string; lines?: string[]; action?: { label: string; onPress: () => void } } {
  if (error instanceof ApiError) {
    if (error.code === 'GUEST_TRIAL_LIMIT_REACHED') {
      return {
        title: 'Bạn đã dùng hết 1 lượt bói thử miễn phí.',
        lines: ['Tạo tài khoản để tiếp tục trải nghiệm và nhận 3 credits khi đăng ký.'],
        action: { label: 'Đăng ký tài khoản', onPress: () => router.push('/register') },
      };
    }
    if (error.code === 'IP_TRIAL_LIMIT_EXCEEDED') {
      return {
        title: 'Địa chỉ IP đã đạt giới hạn lượt bói thử hôm nay.',
        lines: ['Đăng ký tài khoản để tiếp tục bói không giới hạn.'],
        action: { label: 'Đăng nhập / Đăng ký', onPress: () => router.push('/login') },
      };
    }
    if (error.code === 'AI_UNAVAILABLE') {
      return { title: 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.' };
    }
    if (error.status === 0) {
      return { title: 'Mất kết nối hoặc quá thời gian chờ. Vui lòng thử lại.' };
    }
    return { title: errorMessageOf(error) };
  }
  return { title: errorMessageOf(error, 'Đã có lỗi xảy ra. Vui lòng thử lại.') };
}
