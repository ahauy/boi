import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CreditTransactionType, RewardedAdPlacement, type CreditTransactionDto } from '@palmsight/shared';

import Screen, { ScreenHeader } from '../components/Screen';
import Text from '../components/AppText';
import CosmicHand from '../components/CosmicHand';
import RewardedOffer from '../components/RewardedOffer';
import { Banner, Button, Card, SectionLabel } from '../components/ui';
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

  useFocusEffect(
    useCallback(() => {
      void loadFirst();
    }, [loadFirst])
  );

  return (
    <Screen scroll={false} header={<ScreenHeader compact title="Ví credits" onBack={() => router.back()} />}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} tintColor={colors.gold} onRefresh={() => void loadFirst()} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
            <View style={{ borderRadius: radius['3xl'], overflow: 'hidden', borderWidth: 1, borderColor: colors.hairlineStrong }}>
              <LinearGradient colors={['rgba(124,108,246,0.36)', 'rgba(24,34,70,0.92)', 'rgba(8,13,30,0.98)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: spacing.lg, gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[type.eyebrow, { color: colors.goldLight }]}>SỐ DƯ HIỆN TẠI</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.full, backgroundColor: colors.glassFill, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
                    <MaterialCommunityIcons name="shield-check-outline" size={11} color={colors.success} />
                    <Text style={[type.code, { color: colors.body, fontSize: 9 }]}>KHÔNG HẾT HẠN</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.15} style={{ fontFamily: font.displayStrong, fontSize: 62, lineHeight: 64, color: colors.ink }}>
                        {user?.creditBalance ?? 0}
                      </Text>
                      <Text style={[type.captionStrong, { color: colors.goldLight, paddingBottom: 9, letterSpacing: 1.2 }]}>CREDITS</Text>
                    </View>
                    <Text style={[type.caption, { color: colors.mute }]}>Mỗi lần xem bói tiêu thụ 1 credit.</Text>
                  </View>
                  <View style={{ marginRight: -spacing.md }}>
                    <CosmicHand size={110} scan={false} compact />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {user?.referral.canEnterCode ? (
                    <Button label="Nhập mã +1" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/enter-referral')} />
                  ) : null}
                  <Button label="Mời bạn +2" style={{ flex: 1 }} onPress={() => router.push('/referral')} />
                </View>
              </LinearGradient>
            </View>

            <RewardedOffer
              placement={RewardedAdPlacement.WALLET}
              onGranted={() => void loadFirst()}
            />

            {failure && !failureMore && items.length > 0 ? (
              <Banner variant="error" title={failure} action={{ label: 'Thử lại', onPress: () => void loadFirst() }} />
            ) : null}

            <SectionLabel right={<Text style={[type.code, { color: colors.goldLight }]}>{`${items.length} GIAO DỊCH`}</Text>}>BIẾN ĐỘNG CREDITS</SectionLabel>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.sm }}>
              {[0, 1, 2].map((key) => (
                <View key={key} style={{ height: 64, borderRadius: radius.lg, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassBorder }} />
              ))}
              <Text style={[type.caption, { color: colors.mute, textAlign: 'center' }]}>Đang mở sổ credits...</Text>
            </View>
          ) : failure ? (
            <Banner variant="error" title={failure} action={{ label: 'Thử lại', onPress: () => void loadFirst() }} />
          ) : (
            <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
              <Text style={{ fontFamily: font.display, fontSize: 30, color: colors.gold }}>✦</Text>
              <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center' }]}>Chưa có giao dịch credits nào.</Text>
            </Card>
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
  const note = item.type === CreditTransactionType.ADMIN_ADJUST ? item.note : undefined;

  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.065)', 'rgba(255,255,255,0.02)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: `${color}55`, backgroundColor: `${color}12`, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={positive ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={color} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>{transactionLabel(item.type, note)}</Text>
        <Text style={[type.code, { color: colors.stone, fontSize: 10.5 }]}>{formatDateTime(item.createdAt)}</Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={[type.bodyBold, { color, minWidth: 44, textAlign: 'right' }]}>{`${positive ? '+' : ''}${item.amount}`}</Text>
        <Text style={[type.captionStrong, { color: colors.stone, minWidth: 50, textAlign: 'right', fontSize: 11 }]}>{`dư ${item.balanceAfter}`}</Text>
      </View>
    </LinearGradient>
  );
}
