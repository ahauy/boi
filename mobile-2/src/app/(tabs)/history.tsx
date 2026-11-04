import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { ReadingListItemDto } from '@palmsight/shared';

import HeaderCredits from '../../components/HeaderCredits';
import Screen, { ScreenHeader } from '../../components/Screen';
import Text from '../../components/AppText';
import CosmicHand from '../../components/CosmicHand';
import ReadingCard from '../../components/ReadingCard';
import { Banner, Button, SectionLabel } from '../../components/ui';
import { errorMessageOf } from '../../lib/forms';
import { fetchReadings } from '../../lib/readings';
import { colors, radius, spacing, text as type } from '../../theme';
import { t, useI18n } from '../../i18n';

export default function HistoryScreen() {
  useI18n();
  const [items, setItems] = useState<ReadingListItemDto[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [failureMore, setFailureMore] = useState(false);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchReadings();
      setItems((current) => mergeReadings(current, page.items));
      setCursor((current) => (current === undefined ? page.nextCursor : current));
      setFailure(null);
      setFailureMore(false);
    } catch (error) {
      setFailure(errorMessageOf(error, t('history.loadFailed')));
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
      setFailure(errorMessageOf(error, t('history.loadMoreFailed')));
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
    <Screen scroll={false} header={<ScreenHeader eyebrow={t('history.eyebrow')} title={t('history.title')} right={<HeaderCredits />} />}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 136 }}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} tintColor={colors.gold} onRefresh={() => void loadFirst()} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingBottom: spacing.xs }}>
            {failure && !failureMore && items.length > 0 ? (
              <Banner variant="error" title={failure} action={{ label: t('screen.retry'), onPress: () => void loadFirst() }} />
            ) : null}
            {items.length > 0 ? (
              <SectionLabel right={<Text style={[type.code, { color: colors.goldLight }]}>{t('history.count', { count: items.length })}</Text>}>{t('history.all')}</SectionLabel>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.sm }}>
              {[0, 1, 2].map((key) => (
                <View key={key} style={{ height: 112, borderRadius: radius.xl, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassBorder }} />
              ))}
              <Text style={[type.caption, { color: colors.mute, textAlign: 'center', paddingTop: spacing.md }]}>{t('history.opening')}</Text>
            </View>
          ) : failure ? (
            <Banner variant="error" title={failure} action={{ label: t('screen.retry'), onPress: () => void loadFirst() }} />
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm }}>
              <CosmicHand size={210} scan={false} />
              <Text style={[type.eyebrow, { color: colors.gold }]}>{t('history.eyebrowUpper')}</Text>
              <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>{t('history.emptyTitle')}</Text>
              <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center', maxWidth: 300 }]}>
                {t('history.emptyBody')}
              </Text>
              <Button label={t('home.start')} onPress={() => router.navigate('/scan')} />
            </View>
          )
        }
        renderItem={({ item }) => <ReadingCard item={item} />}
        ListFooterComponent={
          <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
            {loadingMore ? <ActivityIndicator color={colors.gold} /> : null}
            {failureMore && failure ? <Banner variant="error" title={failure} action={{ label: t('screen.retry'), onPress: () => void loadMore() }} /> : null}
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
