import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CORE_READING_COST_GEM, ReadingStatus, RewardedAdPlacement } from '@palmsight/shared';

import Screen from '../../components/Screen';
import HeaderCredits from '../../components/HeaderCredits';
import Text from '../../components/AppText';
import CosmicHand from '../../components/CosmicHand';
import ReadingSetupSheet from '../../components/ReadingSetupSheet';
import RewardedOffer from '../../components/RewardedOffer';
import { Banner, Button, Checkbox, LoadingOverlay, SectionLabel } from '../../components/ui';
import NativeAdSlot from '../../ads/native-ad-slot';
import NotEnoughSheet from '../../earn/not-enough-sheet';
import { triggerPaywall } from '../../premium/paywall-triggers';
import { ApiError } from '../../lib/api';
import { errorMessageOf } from '../../lib/forms';
import { haptic } from '../../lib/haptics';
import { handLabel, topicsLabel } from '../../lib/format';
import { createReading, fetchReading } from '../../lib/readings';
import { newIdempotencyKey } from '../../lib/uuid';
import { useAuth } from '../../state/auth';
import { useCapture } from '../../state/capture';
import { useReadingDraft } from '../../state/readingDraft';
import { colors, radius, shadow, spacing, text as type } from '../../theme';

const PROGRESS_SECONDS = 45;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

const STAGE_HINTS = [
  { icon: 'white-balance-sunny' as const, label: 'Đủ sáng' },
  { icon: 'hand-back-right-outline' as const, label: 'Xoè ngón' },
  { icon: 'camera-outline' as const, label: 'Hướng camera' },
];

export default function ScanStudioScreen() {
  const { user, refreshUser } = useAuth();
  const { photo, submitPhoto, clearPhoto } = useCapture();
  const draft = useReadingDraft();
  const { width } = useWindowDimensions();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [notEnoughOpen, setNotEnoughOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [failure, setFailure] = useState<{ title: string; lines?: string[]; retryable: boolean } | null>(null);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const cancelRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);

  const gemBalance = (user as any)?.credits ?? user?.creditBalance ?? 0;
  const submitDisabled = !photo || gemBalance < CORE_READING_COST_GEM || !draft.aiConsent || backgroundBusy;

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed((second) => second + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  async function pickFromGallery() {
    setFailure(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFailure({ title: 'Không thể truy cập thư viện ảnh. Vui lòng cấp quyền hoặc dùng camera.', retryable: false });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false });
    if (result.canceled || result.assets.length === 0) return;
    submitPhoto({ uri: result.assets[0].uri, name: `palm-${Date.now()}.jpg`, type: 'image/jpeg' });
  }

  function trackInBackground(readingId: string) {
    setBackgroundBusy(true);
    void waitForReading(readingId, () => false)
      .then(async (latest) => {
        await refreshUser().catch(() => undefined);
        activeIdRef.current = null;
        setBackgroundBusy(false);
        if (latest.status !== ReadingStatus.PROCESSING) setCancelled(false);
      })
      .catch(() => {
        activeIdRef.current = null;
        setBackgroundBusy(false);
      });
  }

  async function submit() {
    if (gemBalance < CORE_READING_COST_GEM) {
      haptic.warning();
      setNotEnoughOpen(true);
      void triggerPaywall('out_of_currency');
      return;
    }

    if (!photo) return;
    cancelRef.current = false;
    setElapsed(0);
    setBusy(true);
    setCancelled(false);
    setFailure(null);
    try {
      const created = await createReading({
        school: draft.school,
        hand: draft.hand,
        topics: draft.selected,
        aiConsent: draft.aiConsent,
        image: photo,
        idempotencyKey: newIdempotencyKey(),
      });
      activeIdRef.current = created.reading.id;

      // Huỷ trong lúc POST đang bay: quẻ có thể đã được tạo, theo dõi ngầm thay vì cho gửi lại.
      if (cancelRef.current) {
        trackInBackground(created.reading.id);
        return;
      }

      let reading = created.reading;
      if (reading.status === ReadingStatus.PROCESSING) {
        reading = await waitForReading(reading.id, () => cancelRef.current);
      }

      if (cancelRef.current) return;

      await refreshUser();

      if (reading.status === ReadingStatus.REJECTED || reading.status === ReadingStatus.FAILED) {
        haptic.warning();
        activeIdRef.current = null;
        setFailure(outcomeFailure(reading.status, reading.rejectReason));
        return;
      }

      haptic.success();
      activeIdRef.current = null;
      clearPhoto();
      router.push({ pathname: '/reading/[id]', params: { id: reading.id } });
    } catch (error) {
      if (cancelRef.current) {
        if (activeIdRef.current) trackInBackground(activeIdRef.current);
        else setBackgroundBusy(false);
        return;
      }
      haptic.warning();
      setFailure(toFailure(error));
      void refreshUser().catch(() => undefined);
    } finally {
      setBusy(false);
      if (cancelRef.current && !activeIdRef.current) setBackgroundBusy(false);
    }
  }

  function cancelWait() {
    const pendingId = activeIdRef.current;
    cancelRef.current = true;
    haptic.warning();
    setBusy(false);
    setElapsed(0);
    setCancelled(true);
    if (!pendingId) {
      // POST chưa trả id: giữ khoá gửi cho tới khi request kết thúc
      setBackgroundBusy(true);
      return;
    }
    trackInBackground(pendingId);
  }

  return (
    <>
      <Screen
        contentStyle={{ paddingBottom: 120 }}
        header={
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <Text style={[type.eyebrow, { color: colors.gold, letterSpacing: 2.4 }]}>PHÒNG QUÉT</Text>
              <HeaderCredits />
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={[type.headingLg, { color: colors.ink }]} numberOfLines={2}>Đưa bàn tay vào ánh sáng</Text>
              <Text style={[type.caption, { color: colors.mute }]}>
                Ảnh được lưu cùng quẻ trong Lịch sử và có thể xoá bất cứ lúc nào.
              </Text>
            </View>
          </View>
        }
        footer={
          <View style={{ gap: spacing.sm }}>
            {photo ? <Checkbox label="Tôi đồng ý gửi ảnh lòng bàn tay cho hệ thống AI phân tích" checked={draft.aiConsent} onChange={draft.setAiConsent} /> : null}
            <Text style={[type.caption, { color: submitDisabled && photo ? colors.warning : colors.stone, textAlign: 'center', minHeight: 18 }]}>
              {backgroundBusy
                ? 'Quẻ trước vẫn đang xử lý — vui lòng đợi hoặc xem trong Lịch sử.'
                : !photo
                  ? 'Chụp hoặc chọn ảnh lòng bàn tay để bắt đầu.'
                  : gemBalance < CORE_READING_COST_GEM
                    ? `Bạn cần ${CORE_READING_COST_GEM} GEM để xem bói.`
                    : !draft.aiConsent
                      ? 'Bạn cần đồng ý gửi ảnh cho AI phân tích.'
                      : `Mỗi quẻ tiêu thụ ${CORE_READING_COST_GEM} GEM.`}
            </Text>
            {photo ? (
              <Button
                label={busy ? 'Đang luận giải...' : `Xem bói (−${CORE_READING_COST_GEM} GEM)`}
                onPress={() => void submit()}
                loading={busy}
                disabled={submitDisabled}
                size="lg"
                icon={<MaterialCommunityIcons name="star-four-points" size={18} color={colors.onGold} />}
              />
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label="Mở camera"
                  style={{ flex: 2 }}
                  size="lg"
                  onPress={() => {
                    haptic.tap();
                    router.push('/camera');
                  }}
                  icon={<MaterialCommunityIcons name="camera-iris" size={19} color={colors.onGold} />}
                />
                <Button label="Tải ảnh" variant="outline" style={{ flex: 1 }} size="lg" onPress={() => void pickFromGallery()} />
              </View>
            )}
          </View>
        }>
        {gemBalance < CORE_READING_COST_GEM ? (
          <View style={{ gap: spacing.sm }}>
            <Banner
              variant="warning"
              title="Chưa đủ GEM"
              lines={[`Mỗi quẻ đọc bài tiêu thụ ${CORE_READING_COST_GEM} GEM. Vào mục Gems để điểm danh hoặc xem video nhận thêm miễn phí.`]}
              action={{
                label: 'Mở ví Gems',
                onPress: () => router.push('/(tabs)/currency'),
              }}
            />
            <RewardedOffer placement={RewardedAdPlacement.OUT_OF_CREDITS} variant="inline" />
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <SectionLabel right={<Text style={[type.code, { color: colors.goldLight }]}>{`${draft.selected.length} MỤC`}</Text>}>QUẺ ĐANG THIẾT LẬP</SectionLabel>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tùy chỉnh trường phái, mục bói và bàn tay"
            onPress={() => {
              haptic.select();
              setSheetOpen(true);
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <LinearGradient
              colors={['rgba(255,255,255,0.075)', 'rgba(255,255,255,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.xl, padding: spacing.md }}>
              <View style={{ gap: 3, flex: 1 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>{draft.schoolConfig.name}</Text>
                <Text style={[type.caption, { color: colors.mute }]}>{`${handLabel(draft.hand)} · ${topicsLabel(draft.selected, draft.school)}`}</Text>
              </View>
              <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.goldWash, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="tune-variant" size={18} color={colors.goldLight} />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={{ borderRadius: radius['3xl'], overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder, ...shadow.violet }}>
          {photo ? (
            <View style={{ height: 390, backgroundColor: colors.obsidian }}>
              <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel="Ảnh lòng bàn tay đã chọn" />
              <LinearGradient colors={['rgba(4,6,17,0.12)', 'rgba(4,6,17,0.2)', 'rgba(4,6,17,0.92)']} locations={[0, 0.5, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
              <View style={{ position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.full, backgroundColor: 'rgba(4,6,17,0.7)', paddingHorizontal: spacing.sm, paddingVertical: 5 }}>
                  <MaterialCommunityIcons name="check-decagram" size={13} color={colors.goldLight} />
                  <Text style={[type.code, { color: colors.goldLight, fontSize: 10 }]}>ẢNH ĐÃ CHỌN</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chụp lại ảnh"
                  onPress={() => {
                    haptic.select();
                    clearPhoto();
                    setTimeout(() => router.push('/camera'), 100);
                  }}
                  style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: 'rgba(4,6,17,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="camera-retake-outline" size={19} color={colors.ink} />
                </Pressable>
              </View>
              <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 4 }}>
                <Text style={[type.eyebrow, { color: colors.goldLight, fontSize: 10 }]}>{`${handLabel(draft.hand).toUpperCase()} · ${draft.schoolConfig.name.toUpperCase()}`}</Text>
                <Text style={[type.headingMd, { color: colors.ink }]}>Sẵn sàng luận giải</Text>
                <Text style={[type.caption, { color: colors.body }]} numberOfLines={2}>{topicsLabel(draft.selected, draft.school)}</Text>
              </View>
            </View>
          ) : (
            <LinearGradient colors={['rgba(124,108,246,0.26)', 'rgba(15,23,48,0.82)', 'rgba(4,6,17,0.98)']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
                <Text style={[type.eyebrow, { color: colors.goldLight, letterSpacing: 2.2 }]}>KHUNG BÀN TAY</Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
              </View>
              <CosmicHand size={255} />
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
                {STAGE_HINTS.map((hint) => (
                  <View key={hint.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.full, backgroundColor: colors.glassFill, paddingHorizontal: spacing.md, paddingVertical: 6 }}>
                    <MaterialCommunityIcons name={hint.icon} size={12} color={colors.goldLight} />
                    <Text style={[type.code, { color: colors.body, fontSize: 10 }]}>{hint.label.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
              <Text style={[type.caption, { color: colors.mute, textAlign: 'center', maxWidth: 300 }]}>
                Giữ bàn tay trong khung, lòng bàn tay hướng lên, ngón tay xoè tự nhiên.
              </Text>
            </LinearGradient>
          )}
        </View>

        {/* Native Ad Slot when idle (no photo, not busy) */}
        {!photo && !busy ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
            <NativeAdSlot
              availableHeight={260}
              availableWidth={Math.max(300, width - spacing.xl * 2)}
              {...({ placement: 'scan_idle' } as any)}
            />
          </View>
        ) : null}

        {failure ? (
          <Banner
            variant="error"
            title={failure.title}
            lines={failure.lines}
            action={failure.retryable && photo ? { label: 'Thử lại', onPress: () => void submit() } : undefined}
          />
        ) : null}

        {cancelled ? (
          <Banner
            variant="info"
            title="Đã hủy màn chờ kết quả."
            lines={['Quẻ vẫn đang được xử lý phía hệ thống — kiểm tra lại trong Lịch sử sau ít phút.']}
            action={{ label: 'Mở Lịch sử', onPress: () => router.navigate('/history') }}
          />
        ) : null}

        {photo ? (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              label="Chụp lại"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => {
                haptic.select();
                clearPhoto();
                setTimeout(() => router.push('/camera'), 100);
              }}
            />
            <Button label="Chọn ảnh khác" variant="ghost" style={{ flex: 1 }} onPress={() => void pickFromGallery()} />
          </View>
        ) : null}
      </Screen>

      <ReadingSetupSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onStartScan={() => {
          setSheetOpen(false);
          router.navigate('/camera');
        }}
      />

      <NotEnoughSheet
        visible={notEnoughOpen}
        onClose={() => setNotEnoughOpen(false)}
        currentBalance={gemBalance}
        requiredGem={CORE_READING_COST_GEM}
        onEarned={() => {
          void refreshUser().catch(() => undefined);
          setNotEnoughOpen(false);
        }}
      />

      <LoadingOverlay
        visible={busy}
        title="Đang đọc bàn tay"
        message="Hệ thống AI đang nhận diện các đường chỉ chính và liên kết với trường phái cổ truyền."
        progress={elapsed / PROGRESS_SECONDS}
        photoUri={photo?.uri}
        onCancel={cancelWait}
      />
    </>
  );
}

async function waitForReading(id: string, isCancelled: () => boolean): Promise<any> {
  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    if (isCancelled()) return { status: ReadingStatus.PROCESSING, id };
    await sleep(POLL_INTERVAL_MS);
    if (isCancelled()) return { status: ReadingStatus.PROCESSING, id };
    try {
      const reading = await fetchReading(id);
      if (reading.status !== ReadingStatus.PROCESSING) return reading;
    } catch (error) {
      if (error instanceof ApiError && error.status >= 500) {
        // Tạm thời bỏ qua 5xx để thử lại nhịp sau
        continue;
      }
      throw error;
    }
  }
  return { status: ReadingStatus.PROCESSING, id };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function outcomeFailure(status: ReadingStatus, reason?: string | null): { title: string; lines?: string[]; retryable: boolean } {
  if (status === ReadingStatus.REJECTED) {
    return {
      title: 'Ảnh chụp chưa đạt chuẩn nhận diện.',
      lines: [reason ?? 'Không tìm thấy lòng bàn tay rõ nét. Vui lòng chụp lại nơi đủ sáng, xoè đều 5 ngón.'],
      retryable: true,
    };
  }
  return {
    title: 'Hệ thống luận giải gián đoạn.',
    lines: ['Đã hoàn lại lượt xem bói cho bạn. Vui lòng thử lại sau ít phút.'],
    retryable: true,
  };
}

function toFailure(error: unknown): { title: string; lines?: string[]; retryable: boolean } {
  if (error instanceof ApiError) {
    if (error.code === 'INSUFFICIENT_CREDITS') {
      return { title: 'Tài khoản không đủ GEM.', lines: ['Vào mục Gems để điểm danh hoặc xem video nhận thêm.'], retryable: false };
    }
    if (error.code === 'CONCURRENT_PROCESSING') {
      return { title: 'Đang có quẻ khác được xử lý.', lines: ['Vui lòng đợi quẻ hiện tại hoàn tất hoặc kiểm tra Lịch sử.'], retryable: false };
    }
    return { title: errorMessageOf(error, 'Không thể gửi ảnh để luận giải.'), retryable: error.status >= 500 };
  }
  return { title: errorMessageOf(error, 'Đã xảy ra sự cố ngoài ý muốn. Vui lòng thử lại.'), retryable: true };
}
