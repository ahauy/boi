import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { ReadingStatus, READING_SCHOOLS, type ReadingListItemDto } from '@palmsight/shared';

import HeaderCredits from '../../components/HeaderCredits';
import Screen, { ScreenHeader } from '../../components/Screen';
import { Banner, Button, SectionLabel, StatusPill } from '../../components/ui';
import PalmOracle from '../../components/mystic/PalmOracle';
import { errorMessageOf } from '../../lib/forms';
import { haptic } from '../../lib/haptics';
import { formatDateTime, handLabel, SCHOOL_SHORT_LABEL, topicsLabel } from '../../lib/format';
import { fetchReadings } from '../../lib/readings';
import { colors, radius, spacing, text as type } from '../../theme';

export default function HistoryScreen() {
  const [items, setItems] = useState<ReadingListItemDto[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [failureMore, setFailureMore] = useState(false);

  // Làm mới trang đầu rồi merge theo id: không reset về trang 1 khi quay lại từ chi tiết
  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchReadings();
      setItems((current) => mergeReadings(current, page.items));
      setCursor((current) => (current === undefined ? page.nextCursor : current));
      setFailure(null);
      setFailureMore(false);
    } catch (error) {
      setFailure(errorMessageOf(error, 'Không thể tải lịch sử xem bói. Vui lòng thử lại sau.'));
      setFailureMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchReadings(cursor);
      setItems((current) => mergeReadings(current, page.items));
      setCursor(page.nextCursor);
      setFailure(null);
      setFailureMore(false);
    } catch (error) {
      setFailure(errorMessageOf(error, 'Không thể tải thêm lịch sử xem bói. Vui lòng thử lại sau.'));
      setFailureMore(true);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loading, loadingMore]);

  useFocusEffect(
    useCallback(() => {
      void loadFirst();
    }, [loadFirst])
  );

  return (
    <Screen
      scroll={false}
      header={<ScreenHeader eyebrow="Sổ Thiên Mệnh · Lưu Trữ Quẻ Bói" title="Lịch sử xem bói" right={<HeaderCredits />} />}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} tintColor={colors.gold} onRefresh={() => void loadFirst()} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            {failure && !failureMore && items.length > 0 ? (
              <Banner variant="error" title={failure} action={{ label: 'Thử lại', onPress: () => void loadFirst() }} />
            ) : null}
            {items.length > 0 ? (
              <SectionLabel right={<Text style={[type.code, { color: colors.gold }]}>{`${items.length} QUẺ`}</Text>}>
                SỔ THIÊN MỆNH
              </SectionLabel>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center', paddingTop: spacing.xl }]}>Đang mở sổ thiên mệnh...</Text>
          ) : failure ? (
            <Banner variant="error" title={failure} action={{ label: 'Thử lại', onPress: () => void loadFirst() }} />
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg }}>
              <PalmOracle size={210} />
              <Text style={[type.eyebrow, { color: colors.gold }]}>SỔ THIÊN MỆNH</Text>
              <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>Chưa có quẻ nào được lưu</Text>
              <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center', maxWidth: 300 }]}>
                Mỗi lần xem bói sẽ được ghi vào đây, kèm ảnh chỉ tay và bài luận giải.
              </Text>
              <Button label="Bắt đầu xem bói" onPress={() => router.replace('/')} />
            </View>
          )
        }
        renderItem={({ item }) => <HistoryRow item={item} />}
        ListFooterComponent={
          <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
            {loadingMore ? <ActivityIndicator color={colors.gold} /> : null}
            {failureMore && failure ? <Banner variant="error" title={failure} action={{ label: 'Thử lại', onPress: () => void loadMore() }} /> : null}
          </View>
        }
      />
    </Screen>
  );
}

function mergeReadings(current: ReadingListItemDto[], incoming: ReadingListItemDto[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function HistoryRow({ item }: { item: ReadingListItemDto }) {
  const thumbnail = item.annotatedImageUrl ?? item.imageUrl;
  const openable = item.status === ReadingStatus.DONE;

  return (
    <Pressable
      accessibilityRole={openable ? 'button' : undefined}
      disabled={!openable}
      android_ripple={{ color: 'rgba(212,175,55,0.1)', foreground: true }}
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/reading/[id]', params: { id: item.id } });
      }}
      style={({ pressed }) => ({
        borderRadius: radius['2xl'],
        overflow: 'hidden',
        opacity: pressed ? 0.86 : openable ? 1 : 0.72,
      })}>
      <LinearGradient
        colors={['rgba(31,20,56,0.92)', 'rgba(19,12,36,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: radius['2xl'],
          padding: spacing.md,
        }}>
        <View
          style={{
            width: 84,
            height: 110,
            borderRadius: radius.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.hairlineSoft,
            backgroundColor: colors.obsidian,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail, cacheKey: item.id }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Emblem label={SCHOOL_SHORT_LABEL[item.school]} />
          )}
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={[type.eyebrow, { color: colors.gold, letterSpacing: 1.4 }]}>
              {READING_SCHOOLS[item.school]?.name ?? item.school}
            </Text>
            <Text style={[type.code, { color: colors.stone }]}>{formatDateTime(item.createdAt)}</Text>
          </View>

          <Text style={[type.displaySm, { color: colors.ink }]} numberOfLines={1}>
            {`${handLabel(item.hand)} · ${topicsLabel(item.topics, item.school)}`}
          </Text>

          <Text style={[type.caption, { color: colors.mute }]} numberOfLines={2}>
            {item.summary ?? 'Chưa có tóm tắt cho quẻ này.'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
            <StatusPill status={item.status} />
            {openable ? <Text style={{ color: colors.gold, fontSize: 16 }}>›</Text> : null}
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function Emblem({ label }: { label: string }) {
  return (
    <View style={{ width: 56, height: 56, borderRadius: radius.full, borderWidth: 1, borderColor: colors.goldDim, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft }}>
      <Text style={[type.code, { color: colors.gold }]}>{`[${label}]`}</Text>
    </View>
  );
}
