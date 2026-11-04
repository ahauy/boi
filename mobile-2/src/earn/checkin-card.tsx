import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { CurrencyEarnResponseDto } from '@palmsight/shared';

import Text from '../components/AppText';
import { Button } from '../components/ui';
import StreakRestoreModal from './streak-restore-modal';
import { claimCheckin, fetchCurrencyEarn } from './earn-api';
import { watch } from '../ads/rewarded';
import { colors, radius, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

export const CHECKIN_LADDER_DEFAULT = [5, 5, 10, 5, 10, 5, 15];

export interface CheckinCardProps {
  earnState?: CurrencyEarnResponseDto | null;
  onUpdated?: () => void;
}

export function CheckinCard({ earnState: propEarnState, onUpdated }: CheckinCardProps) {
  const [internalState, setInternalState] = useState<CurrencyEarnResponseDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [doubleLoading, setDoubleLoading] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const state = propEarnState ?? internalState;
  const checkinData = state?.checkin;
  const ladder = checkinData?.ladder && checkinData.ladder.length === 7 ? checkinData.ladder : CHECKIN_LADDER_DEFAULT;
  const streakDays = checkinData?.streakDays ?? 0;
  const checkedInToday = checkinData?.checkedInToday ?? false;
  const dayInWeek = checkinData?.dayInWeek ?? (streakDays % 7);
  const restoreOffer = checkinData?.restoreOffer;
  const doubleRemaining = checkinData?.doubleAd?.remaining ?? 1;

  useEffect(() => {
    if (!propEarnState) {
      void loadEarnState();
    }
  }, [propEarnState]);

  async function loadEarnState() {
    try {
      const res = await fetchCurrencyEarn();
      setInternalState(res);
    } catch {
      // Ignore load error
    }
  }

  async function handleClaim() {
    if (checkedInToday) return;

    // If streak is broken and restore is available, prompt restore first
    if (restoreOffer && restoreOffer.missedDays > 0) {
      setRestoreModalOpen(true);
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const res = await claimCheckin();
      haptic.success();
      setNotice(`+${res.amount} GEM nhận thành công!`);
      await loadEarnState();
      onUpdated?.();
    } catch (err: any) {
      setNotice(err?.message ?? 'Không thể điểm danh lúc này.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDoubleCheckin() {
    setDoubleLoading(true);
    setNotice(null);
    try {
      // First ensure today is claimed
      if (!checkedInToday) {
        await claimCheckin().catch(() => undefined);
      }
      const adResult = await watch('checkin_double', 'ad_reward');
      if (adResult.success) {
        haptic.success();
        setNotice('Đã nhân đôi phần thưởng hôm nay!');
        await loadEarnState();
        onUpdated?.();
      } else {
        setNotice('Xem hết quảng cáo để nhân đôi phần thưởng.');
      }
    } catch (err: any) {
      setNotice(err?.message ?? 'Chưa sẵn sàng nhân đôi lúc này.');
    } finally {
      setDoubleLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(28,38,76,0.66)', 'rgba(8,13,30,0.92)']}
        style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.streakBadge}>
            <MaterialCommunityIcons name="fire" size={20} color={colors.goldLight} />
            <Text style={[type.headingSm, { color: colors.goldLight }]}>
              {streakDays > 0 ? `Chuỗi ${streakDays} ngày` : 'Bắt đầu chuỗi điểm danh'}
            </Text>
          </View>

          {restoreOffer && restoreOffer.missedDays > 0 ? (
            <Button
              label="Giữ chuỗi"
              variant="outline"
              size="md"
              noInterstitial
              onPress={() => setRestoreModalOpen(true)}
              style={styles.keepStreakBtn}
            />
          ) : null}
        </View>

        {notice ? (
          <Text style={[type.caption, { color: colors.goldLight, textAlign: 'center' }]}>
            {notice}
          </Text>
        ) : null}

        {/* 7-day ladder grid */}
        <View style={styles.ladderGrid}>
          {ladder.map((amount, index) => {
            const isToday = index === dayInWeek;
            const isPast = index < dayInWeek;
            const isSeventhDay = index === 6;

            return (
              <View
                key={index}
                style={[
                  styles.dayTile,
                  isToday && styles.dayTileToday,
                  isPast && styles.dayTilePast,
                  isSeventhDay && styles.dayTileSeventh,
                ]}>
                <Text
                  style={[
                    type.captionStrong,
                    {
                      color: isToday ? colors.goldLight : isPast ? colors.stone : colors.mute,
                      fontSize: 10,
                    },
                  ]}>
                  {`Ngày ${index + 1}`}
                </Text>
                <MaterialCommunityIcons
                  name="diamond-stone"
                  size={14}
                  color={isToday ? colors.goldLight : colors.gold}
                />
                <Text
                  style={[
                    type.code,
                    {
                      color: isToday ? colors.onGold : colors.ink,
                      fontSize: 11,
                      fontWeight: '700',
                    },
                  ]}>
                  {`+${amount}`}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* Double today's check-in button (accent style above Check in, Playbook §5.5) */}
          {doubleRemaining > 0 ? (
            <Button
              label={
                doubleLoading
                  ? 'Đang mở quảng cáo…'
                  : 'Nhân đôi phần thưởng hôm nay (+GEM)'
              }
              onPress={() => void handleDoubleCheckin()}
              loading={doubleLoading}
              disabled={doubleLoading}
              noInterstitial
              icon={
                <MaterialCommunityIcons
                  name="play-circle-outline"
                  size={18}
                  color={colors.onGold}
                />
              }
            />
          ) : null}

          <Button
            label={
              checkedInToday
                ? 'Đã điểm danh hôm nay'
                : loading
                  ? 'Đang nhận…'
                  : 'Điểm danh ngay'
            }
            variant={checkedInToday ? 'outline' : 'primary'}
            onPress={() => void handleClaim()}
            disabled={checkedInToday || loading}
            loading={loading}
            noInterstitial
          />
        </View>
      </LinearGradient>

      <StreakRestoreModal
        visible={restoreModalOpen}
        brokenStreak={streakDays}
        restoreRemaining={restoreOffer ? 2 : 0}
        onClose={() => setRestoreModalOpen(false)}
        onRestored={() => {
          void loadEarnState();
          onUpdated?.();
        }}
        onReset={() => {
          void handleClaim();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...shadow.card,
    width: '100%',
    borderRadius: radius['3xl'],
    overflow: 'hidden',
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  keepStreakBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  ladderGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  dayTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    backgroundColor: 'rgba(10,16,36,0.6)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 3,
  },
  dayTileToday: {
    borderColor: colors.gold,
    backgroundColor: colors.goldWashStrong,
  },
  dayTilePast: {
    opacity: 0.6,
  },
  dayTileSeventh: {
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
  },
  actions: {
    gap: spacing.sm,
  },
});

export default CheckinCard;
