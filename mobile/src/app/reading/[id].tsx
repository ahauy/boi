import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Pressable, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
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
import { Banner, Button, Card, Chip, SectionLabel } from '../../components/ui';
import MysticDivider from '../../components/mystic/MysticDivider';
import PalmOracle from '../../components/mystic/PalmOracle';
import TarotCorners from '../../components/mystic/TarotCorners';
import { ApiError } from '../../lib/api';
import { errorMessageOf } from '../../lib/forms';
import { haptic } from '../../lib/haptics';
import { useAnimatedValue } from '../../lib/useAnimatedValue';
import { useReduceMotion } from '../../lib/motion';
import { formatDateTime, handLabel, topicLabels, topicsLabel } from '../../lib/format';
import { deleteReading, fetchReading } from '../../lib/readings';
import { colors, font, radius, spacing, text as type } from '../../theme';

const LINE_LEGEND = [
  { key: 'heart', label: 'Tâm đạo', sub: 'Tình cảm', color: colors.danger },
  { key: 'head', label: 'Trí đạo', sub: 'Trí tuệ', color: colors.violetSoft },
  { key: 'life', label: 'Sinh đạo', sub: 'Sinh lực', color: colors.goldLight },
] as const;

export default function ReadingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reading, setReading] = useState<ReadingDto | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);

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

  function confirmDelete() {
    haptic.warning();
    Alert.alert('Xác nhận xoá', 'Bạn có chắc chắn muốn xoá lần xem bói này? Sau khi xoá, kết quả sẽ không thể khôi phục.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: deleting ? 'Đang xoá...' : 'Xoá vĩnh viễn',
        style: 'destructive',
        onPress: async () => {
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
        },
      },
    ]);
  }

  async function shareText() {
    if (!reading) return;
    haptic.select();
    const message = buildShareText(reading);
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
    }
  }

  // Tải ảnh (sơ đồ AI hoặc ảnh gốc) về cache rồi mở share sheet; lỗi thì fallback về chia sẻ chữ
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
      const file = await File.downloadFileAsync(source, new File(Paths.cache, `palmsight-${reading.id}.jpg`), {
        idempotent: true,
      });
      await Sharing.shareAsync(file.uri, {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
        dialogTitle: 'Chia sẻ sơ đồ chỉ tay',
      });
    } catch {
      try {
        await Share.share({ message: buildShareText(reading) });
      } catch {
        await Clipboard.setStringAsync(buildShareText(reading));
      }
    } finally {
      setSharingImage(false);
    }
  }

  return (
    <Screen
      contentStyle={{ paddingHorizontal: 0, gap: 0 }}
      header={<ReadingTopBar onBack={() => router.back()} onShare={shareText} />}
      footer={
        reading && reading.status === ReadingStatus.DONE ? (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button label="Bói thêm (−1 credit)" style={{ flex: 2 }} onPress={() => router.replace('/')} />
            <Button label="Chia sẻ" variant="outline" style={{ flex: 1 }} onPress={shareText} />
          </View>
        ) : null
      }>
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
        <ReadingBody reading={reading} onDelete={confirmDelete} deleting={deleting} onShareImage={shareImage} sharingImage={sharingImage} />
      ) : null}
    </Screen>
  );
}

function ReadingTopBar({ onBack, onShare }: { onBack: () => void; onShare: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
      }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={[type.bodyStrong, { color: colors.goldLight }]}>‹ Quay lại</Text>
      </Pressable>
      <Text
        numberOfLines={1}
        style={[type.eyebrow, { color: colors.gold, letterSpacing: 2, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm }]}>
        LUẬN GIẢI CHI TIẾT
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Chia sẻ kết quả" onPress={onShare} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={[type.bodyStrong, { color: colors.gold }]}>Chia sẻ</Text>
      </Pressable>
    </View>
  );
}

function ReadingBody({
  reading,
  onDelete,
  deleting,
  onShareImage,
  sharingImage,
}: {
  reading: ReadingDto;
  onDelete?: () => void;
  deleting?: boolean;
  onShareImage?: () => void;
  sharingImage?: boolean;
}) {
  const { width } = useWindowDimensions();
  const [usingAnnotated, setUsingAnnotated] = useState(true);
  const result = reading.result;
  const annotated = reading.annotatedImageUrl;
  const imageUrl = (usingAnnotated ? annotated ?? reading.imageUrl : reading.imageUrl) ?? annotated ?? null;
  const schoolName = READING_SCHOOLS[reading.school]?.name ?? reading.school;
  const heroHeight = Math.min(Math.round(width * 1.04), 440);

  if (reading.status === ReadingStatus.REJECTED || reading.status === ReadingStatus.FAILED) {
    return (
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
        <Card ornate glow style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
          <Text style={[type.eyebrow, { color: colors.danger }]}>QUẺ CHƯA THÀNH</Text>
          <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>
            {reading.status === ReadingStatus.REJECTED ? 'Không nhìn rõ lòng bàn tay' : 'Hệ thống bận, đã hoàn 1 credit'}
          </Text>
          <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center' }]}>
            {reading.rejectReason || 'Hãy chụp lại nơi đủ sáng, xoè thẳng bàn tay.'}
          </Text>
          <Text style={[type.captionStrong, { color: colors.success }]}>Đã hoàn 1 credit</Text>
          <Button label="Chụp lại ảnh" onPress={() => router.replace('/')} />
        </Card>
      </View>
    );
  }

  const aspects: { key: string; label: string; content: string }[] = [];
  for (const aspect of LIFE_ASPECTS) {
    const content = result?.aspects?.[aspect.key as LifeAspect];
    if (content) aspects.push({ key: aspect.key, label: aspect.label, content });
  }

  return (
    <View>
      {imageUrl ? (
        <View style={{ width: '100%', height: heroHeight, backgroundColor: colors.obsidian }}>
          <Image
            source={{ uri: imageUrl, cacheKey: reading.id }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={220}
            accessibilityLabel="Ảnh chỉ tay đã phân tích"
          />
          <LinearGradient
            colors={['rgba(11,7,22,0.08)', 'rgba(11,7,22,0.3)', 'rgba(11,7,22,0.96)']}
            locations={[0, 0.48, 1]}
            style={StyleSheet.absoluteFill}
          />
          <TarotCorners inset={12} size={16} />

          <View style={{ position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={styles.imageBadge}>
              <Text style={[type.code, { color: colors.goldLight }]}>{annotated ? '✦ SƠ ĐỒ AI' : 'ẢNH CHỈ TAY'}</Text>
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
                  <Text style={[type.code, { color: colors.goldLight }]}>{usingAnnotated ? 'ẢNH GỐC' : 'SƠ ĐỒ AI'}</Text>
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
                  {sharingImage ? (
                    <ActivityIndicator size="small" color={colors.goldLight} />
                  ) : (
                    <MaterialCommunityIcons name="share-variant-outline" size={19} color={colors.goldLight} />
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={{ position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: spacing.xl, gap: 4 }}>
            <Text style={[type.eyebrow, { color: colors.goldLight }]}>
              {`✦ ${handLabel(reading.hand).toUpperCase()} · ${formatDateTime(reading.createdAt).toUpperCase()}`}
            </Text>
            <Text style={[type.displayLg, { color: colors.ink }]} accessibilityRole="header">
              {schoolName}
            </Text>
            <Text style={[type.caption, { color: colors.body }]}>{topicsLabel(reading.topics, reading.school)}</Text>
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: spacing.xl }}>
          <Card ornate glow style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
            <PalmOracle size={200} />
            <Text style={[type.eyebrow, { color: colors.gold }]}>ẤN CHỨNG THIÊN MỆNH</Text>
            <Text style={[type.displayLg, { color: colors.ink, textAlign: 'center' }]} accessibilityRole="header">{schoolName}</Text>
            <Text style={[type.code, { color: colors.stone }]}>{`${handLabel(reading.hand)} · ${formatDateTime(reading.createdAt)}`}</Text>
          </Card>
        </View>
      )}

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.xl }}>
        <MysticDivider compact symbol="✦ ☽ ☾" />

        {result?.imageQuality === ImageQuality.POOR ? (
          <Banner variant="warning" title="Ảnh hơi mờ, kết quả có thể chưa chính xác." />
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <SectionLabel right={<Text style={[type.code, { color: colors.stone }]}>3 ĐƯỜNG CHÍNH</Text>}>SƠ ĐỒ CHỈ TAY</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {LINE_LEGEND.map((line) => (
              <View key={line.key} style={styles.legendPill}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: line.color, shadowColor: line.color, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
                <Text style={[type.captionStrong, { color: colors.ink }]}>{line.label}</Text>
                <Text style={[type.code, { color: colors.stone }]}>{line.sub.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>

        {reading.topics.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionLabel>MỤC ĐÃ CHỌN</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {reading.topics.map((topic) => (
                <Chip key={topic} label={getTopicLabel(topic, reading.school)} />
              ))}
            </View>
          </View>
        ) : null}

        {result?.summary ? (
          <LinearGradient
            colors={['rgba(44,29,79,0.86)', 'rgba(27,18,51,0.92)', 'rgba(11,7,22,0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radius['2xl'],
              borderWidth: 1,
              borderColor: colors.hairlineStrong,
              padding: spacing.lg,
              gap: spacing.md,
              overflow: 'hidden',
            }}>
            <TarotCorners inset={10} size={14} />
            <Text pointerEvents="none" style={styles.quoteMark}>”</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={[type.eyebrow, { color: colors.gold }]}>TÓM TẮT</Text>
              <View style={{ height: 1, flex: 1, backgroundColor: colors.hairlineSoft }} />
            </View>
            <Text style={[type.quote, { color: colors.ink }]}>{result.summary}</Text>
          </LinearGradient>
        ) : null}

        {(result?.sections ?? []).map((section, index) => (
          <Card key={section.key || section.title || index} style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={[type.monoStrong, { color: colors.gold }]}>{`0${index + 1}`}</Text>
              <Text style={[type.headingMd, { color: colors.ink, flex: 1 }]}>{section.title}</Text>
              <Text style={{ fontFamily: font.display, fontSize: 17, color: colors.gold }}>✦</Text>
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
        ))}

        {aspects.length > 0 ? (
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
        ) : null}

        {result?.advice ? (
          <LinearGradient
            colors={['rgba(36,24,66,0.94)', 'rgba(20,13,38,0.97)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radius['2xl'],
              borderWidth: 1,
              borderColor: colors.hairlineStrong,
              padding: spacing.lg,
              gap: spacing.md,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ fontFamily: font.display, fontSize: 20, color: colors.gold }}>✦</Text>
              <Text style={[type.eyebrow, { color: colors.gold }]}>LỜI KHUYÊN</Text>
              <View style={{ height: 1, flex: 1, backgroundColor: colors.hairlineSoft }} />
            </View>
            <Text style={[type.headingMd, { color: colors.goldLight, lineHeight: 30 }]}>{result.advice}</Text>
          </LinearGradient>
        ) : null}

        <View
          style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.hairlineSoft,
            padding: spacing.md,
            backgroundColor: 'rgba(7,4,14,0.5)',
          }}>
          <Text style={[type.caption, { color: colors.stone }]}>
            {result?.disclaimer ?? 'Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.'}
          </Text>
        </View>

        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xoá lần xem này"
            onPress={onDelete}
            disabled={deleting}
            style={({ pressed }) => ({ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, opacity: pressed ? 0.7 : 1 })}>
            <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>
              {deleting ? 'Đang xoá...' : 'Xoá lần xem này'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ReadingSkeleton() {
  const pulse = useAnimatedValue(0.35);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.55);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.75, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
      <Animated.View style={{ height: 320, borderRadius: radius['2xl'], backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairlineSoft, opacity: pulse }} />
      <Animated.View style={{ height: 112, borderRadius: radius['2xl'], backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairlineSoft, opacity: pulse }} />
      <Animated.View style={{ height: 180, borderRadius: radius['2xl'], backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairlineSoft, opacity: pulse }} />
      <Text style={[type.caption, { color: colors.mute, textAlign: 'center' }]}>Đang mở quẻ...</Text>
    </View>
  );
}

/** Khuôn văn bản chia sẻ giống hệt web (mục "Chia sẻ phần chữ"). */
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
    backgroundColor: 'rgba(11,7,22,0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  imageToggle: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(11,7,22,0.72)',
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  imageAction: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(11,7,22,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    backgroundColor: 'rgba(11,7,22,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  quoteMark: {
    position: 'absolute',
    top: -6,
    right: 16,
    fontFamily: font.displayStrong,
    fontSize: 70,
    lineHeight: 76,
    color: 'rgba(212,175,55,0.14)',
  },
});
