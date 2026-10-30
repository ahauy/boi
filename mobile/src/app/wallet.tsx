import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CreditTransactionType, type CreditTransactionDto } from '@palmsight/shared';

import Screen, { ScreenHeader } from '../components/Screen';
import Text from '../components/AppText';
import { Banner, Button, Card, SectionLabel } from '../components/ui';
import MysticDivider from '../components/mystic/MysticDivider';
import { errorMessageOf } from '../lib/forms';
import { formatDateTime, transactionLabel } from '../lib/format';
import { fetchCreditTransactions } from '../lib/users';
import { useAuth } from '../state/auth';
import { colors, font, radius, spacing, text as type } from '../theme';

export default function WalletScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<CreditTransactionDto[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [failureMore, setFailureMore] = useState(false);

  // Làm mới trang đầu rồi merge theo id: giữ nguyên các trang đã tải và vị trí cuộn
  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchCreditTransactions();
      setItems((current) => mergeTransactions(current, page.items));
      setCursor((current) => (current === undefined ? page.nextCursor : current));
      setFailure(null);
      setFailureMore(false);
    } catch (error) {
      setFailure(errorMessageOf(error, 'Không tải được lịch sử giao dịch.'));
      setFailureMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchCreditTransactions(cursor);
      setItems((current) => mergeTransactions(current, page.items));
      setCursor(page.nextCursor);
      setFailure(null);
      setFailureMore(false);
    } catch (error) {
      setFailure(errorMessageOf(error, 'Không tải được lịch sử giao dịch.'));
      setFailureMore(true);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loading, loadingMore]);

  // Tải lại khi màn được focus: số dư/lịch sử có thể đổi sau khi nhập mã giới thiệu
  useFocusEffect(
    useCallback(() => {
      void loadFirst();
    }, [loadFirst])
  );

  return (
    <Screen
      scroll={false}
      header={<ScreenHeader compact title="Ví credits" onBack={() => router.back()} />}>
      <Card ornate glow style={{ gap: spacing.md, paddingVertical: spacing.xl }}>
        <Text style={[type.eyebrow, { color: colors.gold }]}>SỐ DƯ HIỆN TẠI</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            maxFontSizeMultiplier={1.15}
            style={{ fontFamily: font.displayStrong, fontSize: 58, lineHeight: 60, color: colors.gold }}>
            {user?.creditBalance ?? 0}
          </Text>
          <Text style={[type.captionStrong, { color: colors.goldLight, paddingBottom: 8, letterSpacing: 1.4 }]}>CREDITS</Text>
        </View>
        <MysticDivider compact symbol="✦ ☽ ☾" />
        <Text style={[type.caption, { color: colors.stone }]}>
          Credits không hết hạn. Mỗi lần xem bói tiêu thụ 1 credit.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
          <Button label="Nhập mã giới thiệu (+1)" variant="outline" style={{ flex: 1, minWidth: 170 }} onPress={() => router.push('/enter-referral')} />
          <Button label="Mời bạn bè nhận thêm credits" variant="ghost" style={{ flex: 1, minWidth: 170 }} onPress={() => router.push('/referral')} />
        </View>
      </Card>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} tintColor={colors.gold} onRefresh={() => void loadFirst()} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <SectionLabel right={<Text style={[type.code, { color: colors.stone }]}>{`${items.length} GIAO DỊCH`}</Text>}>LỊCH SỬ BIẾN ĐỘNG</SectionLabel>
            {failure && !failureMore && items.length > 0 ? (
              <Banner variant="error" title={failure} action={{ label: 'Thử lại', onPress: () => void loadFirst() }} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Text style={[type.bodyMd, { color: colors.mute, paddingTop: spacing.md }]}>✦ Đang mở sổ linh thạch...</Text>
          ) : failure ? (
            <Banner variant="error" title={failure} action={{ label: 'Thử lại', onPress: () => void loadFirst() }} />
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl }}>
              <Text style={{ fontFamily: font.display, fontSize: 34, color: colors.gold }}>✦</Text>
              <Text style={[type.bodyMd, { color: colors.mute }]}>Chưa có giao dịch credits nào.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <TransactionRow item={item} />}
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

function mergeTransactions(current: CreditTransactionDto[], incoming: CreditTransactionDto[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function TransactionRow({ item }: { item: CreditTransactionDto }) {
  const positive = item.amount > 0;
  const color = positive ? colors.success : colors.danger;
  // Điều chỉnh của admin có note mô tả, các loại khác tự suy từ nhãn
  const note = item.type === CreditTransactionType.ADMIN_ADJUST ? item.note : undefined;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.hairlineSoft,
        borderRadius: radius.lg,
        backgroundColor: 'rgba(20,13,38,0.62)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: positive ? 'rgba(52,211,153,0.45)' : 'rgba(251,113,133,0.45)',
          backgroundColor: positive ? 'rgba(52,211,153,0.08)' : 'rgba(251,113,133,0.08)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ fontFamily: font.monoMedium, fontSize: 12, color }}>{positive ? '+' : '−'}</Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: colors.ink }]}>{transactionLabel(item.type, note)}</Text>
        <Text style={[type.code, { color: colors.stone }]}>{formatDateTime(item.createdAt)}</Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={[type.bodyBold, { color, minWidth: 46, textAlign: 'right' }]}>{`${positive ? '+' : ''}${item.amount}`}</Text>
        <Text style={[type.captionStrong, { color: colors.stone, minWidth: 52, textAlign: 'right' }]}>{`dư ${item.balanceAfter}`}</Text>
      </View>
    </View>
  );
}
