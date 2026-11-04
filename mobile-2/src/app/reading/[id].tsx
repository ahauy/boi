import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Share, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ImageQuality,
  LIFE_ASPECTS,
  LIFE_ASPECTS_MAP,
  LifeAspect,
  READING_SCHOOLS,
  ReadingStatus,
  getTopicLabel,
  type ReadingDto,
} from '@palmsight/shared';

import Screen from '../../components/Screen';
import Text from '../../components/AppText';
import CosmicHand from '../../components/CosmicHand';
import { Banner, Button, Card, Chip, IconButton, SectionLabel } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { errorMessageOf } from '../../lib/forms';
import { haptic } from '../../lib/haptics';
import { useAppActive } from '../../lib/motion';
import { formatDateTime, handLabel, topicLabels, topicsLabel } from '../../lib/format';
import { deleteReading, fetchReading } from '../../lib/readings';
import { useAuthActions } from '../../state/auth';
import { colors, font, radius, spacing, text as type } from '../../theme';

const TABS = [
  { key: 'overview', label: 'Tổng quan', icon: 'text-box-outline' },
  { key: 'lines', label: 'Đường chỉ', icon: 'gesture-swipe' },
  { key: 'aspects', label: 'Khía cạnh', icon: 'compass-outline' },
  { key: 'advice', label: 'Lời khuyên', icon: 'star-four-points-outline' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const COMPACT_TAB_LABELS: Record<TabKey, string> = {
  overview: 'Tổng',
  lines: 'Đường',
  aspects: 'Khía cạnh',
  advice: 'Khuyên',
};

const LINE_LEGEND = [
  { key: 'heart', label: 'Tâm đạo', sub: 'Tình cảm', color: colors.danger },
  { key: 'head', label: 'Trí đạo', sub: 'Trí tuệ', color: colors.violetSoft },
  { key: 'life', label: 'Sinh đạo', sub: 'Sinh lực', color: colors.goldLight },
] as const;

export default function ReadingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshUser } = useAuthActions();
  const appActive = useAppActive();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [reading, setReading] = useState<ReadingDto | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  function showShareNotice(message: string) {
    setShareNotice(message);
    setTimeout(() => setShareNotice(null), 2600);
  }

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setReading(await fetchReading(id));
      setFailure(null);
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.status === 404
          ? 'Lần xem bói này không tồn tại hoặc đã bị xoá.'
          : errorMessageOf(error, 'Đã có lỗi xảy ra khi tải kết quả xem bói.')
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Quẻ đang xử lý: tự cập nhật đến khi có kết quả để mở từ Lịch sử không bị kẹt.
  // Khi app ra sau thì nghỉ; effect chạy lại ngay khi quay về nên kết quả không bị trễ.
  useEffect(() => {
    if (!id || !appActive || reading?.status !== ReadingStatus.PROCESSING) return;
    let cancelled = false;

    async function poll() {
      try {
        const next = await fetchReading(id);
        if (cancelled) return;
        setReading(next);
        if (next.status !== ReadingStatus.PROCESSING) {
          await refreshUser().catch(() => undefined);
        }
      } catch {
        // Lỗi mạng tạm thời: giữ nguyên màn trạng thái và thử lại ở nhịp sau
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [appActive, id, reading?.status, refreshUser]);

  function confirmDelete() {
    haptic.warning();
    const message = 'Bạn có chắc chắn muốn xoá lần xem bói này? Sau khi xoá, kết quả sẽ không thể khôi phục.';
    if (Platform.OS === 'web') {
      const confirmFn = (globalThis as unknown as { confirm?: (text: string) => boolean }).confirm;
      if (confirmFn?.(message)) void performDelete();
      return;
    }
    Alert.alert('Xác nhận xoá', message, [
      { text: 'Huỷ', style: 'cancel' },
      { text: deleting ? 'Đang xoá...' : 'Xoá vĩnh viễn', style: 'destructive', onPress: () => void performDelete() },
    ]);
  }

  async function performDelete() {
    setDeleting(true);
    try {
      await deleteReading(id);
      haptic.success();
      router.replace('/history');
    } catch (error) {
      haptic.warning();
      setFailure(errorMessageOf(error, 'Không thể xoá lần xem bói.'));
    } finally {
      setDeleting(false);
    }
  }

  async function shareText() {
    if (!reading) return;
    haptic.select();
    const message = buildShareText(reading);
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      showShareNotice('Đã sao chép nội dung chia sẻ vào bộ nhớ tạm.');
    }
  }

  async function shareImage() {
    if (!reading || sharingImage) return;
    const source = reading.annotatedImageUrl ?? reading.imageUrl;
    if (!source) {
      await shareText();
      return;
    }
    haptic.select();
    setSharingImage(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        await Share.share({ message: buildShareText(reading) });
        return;
      }
      const file = await File.downloadFileAsync(source, new File(Paths.cache, `palmsight-${reading.id}.jpg`), { idempotent: true });
      await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Chia sẻ sơ đồ chỉ tay' });
    } catch {
      try {
        await Share.share({ message: buildShareText(reading) });
      } catch {
        await Clipboard.setStringAsync(buildShareText(reading));
        showShareNotice('Đã sao chép nội dung chia sẻ vào bộ nhớ tạm.');
      }
    } finally {
      setSharingImage(false);
    }
  }

  return (
    <Screen
      scrollRef={scrollRef}
      contentStyle={{ paddingHorizontal: 0, gap: 0 }}
      header={<ReadingTopBar onBack={() => router.back()} />}
      footer={
        reading && reading.status === ReadingStatus.DONE ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <IconButton icon="share-variant-outline" accessibilityLabel="Chia sẻ văn bản kết quả" onPress={() => void shareText()} />
            <Button label="Bói thêm (−1 credit)" style={{ flex: 1 }} onPress={() => router.navigate('/scan')} />
            <IconButton icon="trash-can-outline" accessibilityLabel="Xoá lần xem này" onPress={confirmDelete} style={{ borderColor: 'rgba(251,113,133,0.34)' }} />
          </View>
        ) : null
      }>
      {shareNotice ? (
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
          <Banner variant="success" title={shareNotice} />
        </View>
      ) : null}

      {loading && !reading ? <ReadingSkeleton /> : null}

      {!loading && failure ? (
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <Card ornate glow style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
            <Text style={[type.eyebrow, { color: colors.danger }]}>KHÔNG MỞ ĐƯỢC QUẺ</Text>
            <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>Không tìm thấy lần xem bói</Text>
            <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center' }]}>{failure}</Text>
            <Button label="Quay lại Lịch sử" onPress={() => router.replace('/history')} />
          </Card>
        </View>
      ) : null}

      {reading ? (
        <ReadingBody reading={reading} onDelete={confirmDelete} deleting={deleting} onShareImage={shareImage} sharingImage={sharingImage} scrollRef={scrollRef} />
      ) : null}
    </Screen>
  );
}

function ReadingTopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: spacing.sm }}>
      <IconButton icon="chevron-left" accessibilityLabel="Quay lại" onPress={onBack} />
      <Text numberOfLines={1} style={[type.eyebrow, { color: colors.gold, letterSpacing: 2, flex: 1, textAlign: 'center' }]}>
        LUẬN GIẢI CHI TIẾT
      </Text>
      <View style={{ width: 46, height: 46 }} />
    </View>
  );
}

function ReadingBody({
  reading,
  onDelete,
  deleting,
  onShareImage,
  sharingImage,
  scrollRef,
}: {
  reading: ReadingDto;
  onDelete?: () => void;
  deleting?: boolean;
  onShareImage?: () => void;
  sharingImage?: boolean;
  scrollRef: React.RefObject<ScrollViewInstance | null>;
}) {
  const { width, height } = useWindowDimensions();
  const compactTabs = width < 380;
  const [usingAnnotated, setUsingAnnotated] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');
  const [tabsY, setTabsY] = useState(0);
  const result = reading.result;
  const annotated = reading.annotatedImageUrl;
  const imageUrl = (usingAnnotated ? annotated ?? reading.imageUrl : reading.imageUrl) ?? annotated ?? null;
  const schoolName = READING_SCHOOLS[reading.school]?.name ?? reading.school;
  const heroHeight = Math.min(Math.round(width * 1.02), height < 720 ? 280 : 430);

  if (reading.status === ReadingStatus.PROCESSING) {
    return (
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
        <Card ornate glow tone="violet" style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={[type.eyebrow, { color: colors.gold }]}>THIÊN CƠ ĐANG MỞ</Text>
          <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>Đang luận giải quẻ</Text>
          <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center', maxWidth: 300 }]}>
            AI đang đọc các đường chỉ tay. Màn này sẽ tự cập nhật khi có kết quả.
          </Text>
          <Text style={[type.code, { color: colors.goldLight }]}>{`${handLabel(reading.hand)} · ${schoolName}`}</Text>
          <Button label="Về Lịch sử" variant="outline" onPress={() => router.replace('/history')} />
        </Card>
      </View>
    );
  }

  if (reading.status === ReadingStatus.REJECTED || reading.status === ReadingStatus.FAILED) {
    return (
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
        <Card ornate glow style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
          <Text style={[type.eyebrow, { color: colors.danger }]}>QUẺ CHƯA THÀNH</Text>
          <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>
            {reading.status === ReadingStatus.REJECTED ? 'Không nhìn rõ lòng bàn tay' : 'Hệ thống bận'}
          </Text>
          <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center' }]}>
            {reading.status === ReadingStatus.REJECTED
              ? reading.rejectReason || 'Hãy chụp lại nơi đủ sáng, xoè thẳng bàn tay.'
              : 'PalmSight chưa thể luận giải lần này. Bạn có thể thử lại hoặc xoá quẻ.'}
          </Text>
          <Text style={[type.captionStrong, { color: colors.success }]}>Đã hoàn 1 credit</Text>
          <Button label="Chụp lại ảnh" onPress={() => router.navigate('/scan')} />
          {onDelete ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Xoá lần xem này" onPress={onDelete} disabled={deleting} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
              <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{deleting ? 'Đang xoá...' : 'Xoá lần xem này'}</Text>
            </Pressable>
          ) : null}
        </Card>
      </View>
    );
  }

  const aspects: { key: string; label: string; content: string }[] = [];
  for (const aspect of LIFE_ASPECTS) {
    const content = result?.aspects?.[aspect.key as LifeAspect];
    if (content) aspects.push({ key: aspect.key, label: aspect.label, content });
  }

  const sections = result?.sections ?? [];

  function selectTab(next: TabKey) {
    haptic.select();
    setTab(next);
    if (tabsY > 0) {
      scrollRef.current?.scrollTo({ y: Math.max(0, tabsY - 8), animated: true });
    }
  }

  return (
    <View>
      {imageUrl ? (
        <View style={{ width: '100%', height: heroHeight, backgroundColor: colors.obsidian }}>
          <Image source={{ uri: imageUrl, cacheKey: reading.id }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={220} accessibilityLabel="Ảnh chỉ tay đã phân tích" />
          <LinearGradient colors={['rgba(4,6,17,0.08)', 'rgba(4,6,17,0.38)', 'rgba(4,6,17,0.98)']} locations={[0, 0.46, 1]} style={StyleSheet.absoluteFill} />

          <View style={{ position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={styles.imageBadge}>
              <Text style={[type.code, { color: colors.goldLight, fontSize: 10 }]}>{usingAnnotated && annotated ? '✦ SƠ ĐỒ AI' : 'ẢNH CHỈ TAY'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
              {annotated ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={usingAnnotated ? 'Xem ảnh gốc' : 'Xem sơ đồ AI'}
                  onPress={() => {
                    haptic.select();
                    setUsingAnnotated((value) => !value);
                  }}
                  style={({ pressed }) => [styles.imageToggle, pressed && { opacity: 0.8 }]}>
                  <Text style={[type.code, { color: colors.goldLight, fontSize: 10 }]}>{usingAnnotated ? 'ẢNH GỐC' : 'SƠ ĐỒ AI'}</Text>
                </Pressable>
              ) : null}
              {onShareImage ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chia sẻ ảnh chỉ tay"
                  accessibilityState={{ busy: Boolean(sharingImage) }}
                  disabled={sharingImage}
                  onPress={onShareImage}
                  style={({ pressed }) => [styles.imageAction, pressed && { opacity: 0.8 }]}>
                  {sharingImage ? <ActivityIndicator size="small" color={colors.goldLight} /> : <MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.goldLight} />}
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={{ position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: spacing.xl, gap: 4 }}>
            <Text style={[type.eyebrow, { color: colors.goldLight, fontSize: 10 }]}>
              {`✦ ${handLabel(reading.hand).toUpperCase()} · ${formatDateTime(reading.createdAt).toUpperCase()}`}
            </Text>
            <Text style={[type.displayLg, { color: colors.ink }]} accessibilityRole="header">
              {schoolName}
            </Text>
            <Text style={[type.caption, { color: colors.body }]} numberOfLines={2}>{topicsLabel(reading.topics, reading.school)}</Text>
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.xl }}>
          <Card ornate glow tone="violet" style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
            <CosmicHand size={190} />
            <Text style={[type.eyebrow, { color: colors.gold }]}>ẤN CHỨNG THIÊN MỆNH</Text>
            <Text style={[type.displayLg, { color: colors.ink, textAlign: 'center' }]} accessibilityRole="header">{schoolName}</Text>
            <Text style={[type.code, { color: colors.stone }]}>{`${handLabel(reading.hand)} · ${formatDateTime(reading.createdAt)}`}</Text>
          </Card>
        </View>
      )}

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }} onLayout={(event) => setTabsY(event.nativeEvent.layout.y)}>
        <View accessibilityRole="tablist" style={styles.tabBar}>
          {TABS.map((item) => {
            const active = item.key === tab;
            const label = compactTabs ? COMPACT_TAB_LABELS[item.key] : item.label;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
                aria-selected={active}
                onPress={() => selectTab(item.key)}
                style={({ pressed }) => [styles.tabItem, active && styles.tabItemActive, pressed && { opacity: 0.75 }]}>
                {compactTabs ? null : <MaterialCommunityIcons name={item.icon} size={14} color={active ? colors.goldLight : colors.stone} />}
                <Text style={[type.captionStrong, { color: active ? colors.goldLight : colors.stone, fontSize: 10 }]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg }}>
        {result?.imageQuality === ImageQuality.POOR ? <Banner variant="warning" title="Ảnh hơi mờ, kết quả có thể chưa chính xác." /> : null}

        {tab === 'overview' ? (
          <>
            {result?.summary ? (
              <LinearGradient colors={['rgba(124,108,246,0.28)', 'rgba(18,27,58,0.9)', 'rgba(8,13,30,0.96)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.hairlineStrong, padding: spacing.lg, gap: spacing.md, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <MaterialCommunityIcons name="star-four-points" size={14} color={colors.gold} />
                  <Text style={[type.eyebrow, { color: colors.gold }]}>TÓM TẮT THIÊN CƠ</Text>
                  <View style={{ height: 1, flex: 1, backgroundColor: colors.hairlineSoft }} />
                </View>
                <Text style={[type.quote, { color: colors.ink }]}>{result.summary}</Text>
              </LinearGradient>
            ) : (
              <Card><Text style={[type.bodyMd, { color: colors.mute }]}>Quẻ này chưa có phần tóm tắt.</Text></Card>
            )}

            {reading.topics.length > 0 ? (
              <Card style={{ gap: spacing.sm }}>
                <SectionLabel>ĐIỀU BẠN ĐÃ HỎI</SectionLabel>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {reading.topics.map((topic) => (
                    <Chip key={topic} label={getTopicLabel(topic, reading.school)} />
                  ))}
                </View>
              </Card>
            ) : null}

            <Card style={{ gap: spacing.sm }}>
              <SectionLabel>SƠ ĐỒ CHỈ TAY</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {LINE_LEGEND.map((line) => (
                  <View key={line.key} style={styles.legendPill}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: line.color }} />
                    <Text style={[type.captionStrong, { color: colors.ink }]}>{line.label}</Text>
                    <Text style={[type.code, { color: colors.stone, fontSize: 9 }]}>{line.sub.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        ) : null}

        {tab === 'lines' ? (
          sections.length > 0 ? (
            sections.map((section, index) => (
              <Card key={section.key || section.title || index} style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={[type.monoStrong, { color: colors.gold }]}>{`0${index + 1}`}</Text>
                  <Text style={[type.headingMd, { color: colors.ink, flex: 1 }]}>{section.title}</Text>
                  <Text style={{ fontFamily: font.display, fontSize: 18, color: colors.gold }}>✦</Text>
                </View>
                <View style={{ borderLeftWidth: 2, borderLeftColor: colors.hairlineStrong, paddingLeft: spacing.md, gap: spacing.md }}>
                  <View style={{ gap: 4 }}>
                    <Text style={[type.eyebrow, { color: colors.violetSoft, letterSpacing: 1.8 }]}>QUAN SÁT</Text>
                    <Text style={[type.bodyMd, { color: colors.body }]}>{section.observation}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.hairlineSoft }} />
                  <View style={{ gap: 4 }}>
                    <Text style={[type.eyebrow, { color: colors.gold, letterSpacing: 1.8 }]}>Ý NGHĨA</Text>
                    <Text style={[type.bodyMd, { color: colors.body }]}>{section.meaning}</Text>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <EmptyTab text="Quẻ này chưa có phần luận giải từng đường chỉ." />
          )
        ) : null}

        {tab === 'aspects' ? (
          aspects.length > 0 ? (
            <Card style={{ gap: spacing.md }}>
              <SectionLabel>KHÍA CẠNH CUỘC SỐNG</SectionLabel>
              {aspects.map((row, index) => (
                <View key={row.key} style={{ gap: spacing.sm }}>
                  {index > 0 ? <View style={{ height: 1, backgroundColor: colors.hairlineSoft }} /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.gold }} />
                    <Text style={[type.bodyBold, { color: colors.goldLight }]}>{row.label}</Text>
                  </View>
                  <Text style={[type.bodyMd, { color: colors.body }]}>{row.content}</Text>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyTab text="Quẻ này không chọn khía cạnh cuộc sống riêng." />
          )
        ) : null}

        {tab === 'advice' ? (
          <>
            {result?.advice ? (
              <LinearGradient colors={['rgba(231,199,119,0.2)', 'rgba(24,34,68,0.92)', 'rgba(8,13,30,0.96)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.hairlineStrong, padding: spacing.lg, gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <MaterialCommunityIcons name="star-four-points" size={14} color={colors.gold} />
                  <Text style={[type.eyebrow, { color: colors.gold }]}>LỜI KHUYÊN</Text>
                  <View style={{ height: 1, flex: 1, backgroundColor: colors.hairlineSoft }} />
                </View>
                <Text style={[type.headingMd, { color: colors.ink, lineHeight: 31 }]}>{result.advice}</Text>
              </LinearGradient>
            ) : (
              <EmptyTab text="Quẻ này chưa có lời khuyên." />
            )}
            <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.md, backgroundColor: colors.glassFill }}>
              <Text style={[type.caption, { color: colors.stone }]}>
                {result?.disclaimer ?? 'Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.'}
              </Text>
            </View>
            {onDelete ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Xoá lần xem này" onPress={onDelete} disabled={deleting} style={({ pressed }) => ({ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, opacity: pressed ? 0.7 : 1 })}>
                <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{deleting ? 'Đang xoá...' : 'Xoá lần xem này'}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function EmptyTab({ text }: { text: string }) {
  return (
    <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
      <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.gold }}>✦</Text>
      <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center' }]}>{text}</Text>
    </Card>
  );
}

function ReadingSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, paddingTop: spacing.sm }}>
      <View style={{ height: 330, borderRadius: radius['2xl'], backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassBorder }} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {[0, 1, 2, 3].map((key) => (
          <View key={key} style={{ flex: 1, height: 38, borderRadius: radius.full, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassBorder }} />
        ))}
      </View>
      <View style={{ height: 130, borderRadius: radius['2xl'], backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassBorder }} />
      <Text style={[type.caption, { color: colors.mute, textAlign: 'center' }]}>Đang mở quẻ...</Text>
    </View>
  );
}

function buildShareText(reading: ReadingDto): string {
  const result = reading.result;
  const lines: string[] = [
    `PALMSIGHT - ${READING_SCHOOLS[reading.school]?.name ?? reading.school}`,
    `${handLabel(reading.hand)} · ${formatDateTime(reading.createdAt)}`,
    `Mục xem: ${topicLabels(reading.topics, reading.school).join(', ')}`,
  ];

  if (result?.summary) lines.push('', '[Tóm tắt]', result.summary);

  for (const section of result?.sections ?? []) {
    lines.push('', `[${section.title}]`, 'Quan sát:', section.observation, 'Ý nghĩa:', section.meaning);
  }

  const aspects = Object.entries(result?.aspects ?? {});
  if (aspects.length > 0) {
    lines.push('', '[Khía cạnh cuộc sống]');
    for (const [key, content] of aspects) {
      lines.push(`${LIFE_ASPECTS_MAP[key as LifeAspect]?.label ?? key}: ${content}`);
    }
  }

  if (result?.advice) lines.push('', '[Lời khuyên]', result.advice);
  if (result?.disclaimer) lines.push('', result.disclaimer);

  return lines.join('\n');
}

const styles = StyleSheet.create({
  imageBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(4,6,17,0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  imageToggle: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(4,6,17,0.72)',
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
  },
  imageAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(4,6,17,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    borderRadius: radius.full,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 2,
  },
  tabItemActive: {
    backgroundColor: colors.goldWashStrong,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.full,
    backgroundColor: colors.glassFill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
});
