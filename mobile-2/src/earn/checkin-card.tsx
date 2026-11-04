import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdRewardKind, ECONOMY_DEFAULTS } from '@palmsight/shared';
import type { CurrencyEarnResponseDto } from '@palmsight/shared';

import Text from '../components/AppText';
import { Button, ProgressBar } from '../components/ui';
import StreakRestoreModal from './streak-restore-modal';
import { claimCheckin } from './earn-api';
import { watch, WatchResult } from '../ads/rewarded';
import { useAuth } from '../state/auth';
import { useI18n } from '../i18n';
import { colors, radius, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

const RESTORE_POPUP_DAY_KEY = 'palmsight.restorePopupDay';

function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const pad = (value: number) => String(value).padStart(2, '0');
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map(pad)
    .join(':');
}

export interface CheckinCardProps {
  earnState?: CurrencyEarnResponseDto | null;
  onUpdated?: () => void;
}

export function CheckinCard({ earnState, onUpdated }: CheckinCardProps) {
  const { user, setCreditBalance } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [doubleLoading, setDoubleLoading] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [syncedSecondsLeft, setSyncedSecondsLeft] = useState<number | null>(null);

  // True when the popup was opened from the ad button: the ad plays after it resolves (§7.2).
  const adPendingRef = useRef(false);
  const reopenWhenVipRef = useRef(false);

  const isVip = Boolean(user?.vip?.active);
  const checkin = earnState?.checkin;
  const ladder: readonly number[] =
    checkin?.ladder?.length === 7 ? checkin.ladder : ECONOMY_DEFAULTS.CHECKIN_LADDER;
  const streakDays = checkin?.streakDays ?? 0;
  const checkedInToday = checkin?.checkedInToday ?? false;
  const deviceUsedToday = checkin?.deviceUsedToday ?? false;
  const dayInWeek = checkin?.dayInWeek ?? 1;
  const restoreOffer = checkin?.restoreOffer ?? null;
  const doubleRemaining = checkin?.doubleAd?.remaining ?? 0;
  const nextMilestone = checkin?.nextMilestone ?? null;
  const milestones = Object.entries(checkin?.milestones ?? {})
    .map(([day, bonus]) => ({ day: Number(day), bonus }))
    .sort((a, b) => a.day - b.day);
  const previousMilestoneDay = milestones.filter((item) => item.day <= streakDays).pop()?.day ?? 0;
  const milestoneProgress = nextMilestone
    ? (streakDays - previousMilestoneDay) / (nextMilestone.day - previousMilestoneDay)
    : 1;
  const hasRestoreOffer = Boolean(restoreOffer && restoreOffer.missedDays > 0 && !checkedInToday);
  const rewardDay = earnState?.rewardDay;

  // Restart the countdown during render whenever the server sends a new value.
  const serverSecondsLeft = earnState?.secondsUntilReset ?? null;
  if (serverSecondsLeft !== syncedSecondsLeft) {
    setSyncedSecondsLeft(serverSecondsLeft);
    setSecondsLeft(serverSecondsLeft);
  }

  const hasCountdown = secondsLeft !== null;
  useEffect(() => {
    if (!hasCountdown) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, [hasCountdown]);

  // The popup opens by itself once per reward day per device (§7.2).
  useEffect(() => {
    if (!hasRestoreOffer || !rewardDay) return;
    let cancelled = false;
    void (async () => {
      const shownDay = await AsyncStorage.getItem(RESTORE_POPUP_DAY_KEY).catch(() => null);
      if (cancelled || shownDay === rewardDay) return;
      setRestoreModalOpen(true);
      void AsyncStorage.setItem(RESTORE_POPUP_DAY_KEY, rewardDay).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasRestoreOffer, rewardDay]);

  useEffect(() => {
    if (isVip && hasRestoreOffer && reopenWhenVipRef.current) {
      reopenWhenVipRef.current = false;
      setRestoreModalOpen(true);
    }
  }, [isVip, hasRestoreOffer]);

  async function claim(): Promise<boolean> {
    setNotice(null);
    try {
      const res = await claimCheckin();
      setCreditBalance(res.balance);
      haptic.success();
      setNotice(
        res.milestoneBonus > 0
          ? t('earn.milestone.reached', { day: res.streakDays, bonus: res.milestoneBonus })
          : t('earn.reward.added', { amount: res.amount })
      );
      return true;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : null);
      return false;
    }
  }

  function noticeForAd(result: WatchResult): string | null {
    switch (result.status) {
      case 'rewarded':
        return t('earn.reward.added', { amount: result.claim?.amount ?? 0 });
      case 'capped':
        return t('earn.reward.limitReached');
      case 'no_ad':
        return t('earn.reward.noAd');
      case 'closed':
        return null;
      default:
        return result.errorMessage ?? null;
    }
  }

  async function playDoubleAd() {
    setDoubleLoading(true);
    const result = await watch('checkin_double', AdRewardKind.CHECKIN);
    setDoubleLoading(false);
    if (result.status === 'rewarded') haptic.success();
    setNotice(noticeForAd(result));
    onUpdated?.();
  }

  async function handleClaim() {
    if (checkedInToday) return;
    if (hasRestoreOffer) {
      adPendingRef.current = false;
      setRestoreModalOpen(true);
      return;
    }
    setLoading(true);
    await claim();
    setLoading(false);
    onUpdated?.();
  }

  // Never locked: one tap checks in first when needed, then plays the ad (§5.5).
  async function handleDoubleCheckin() {
    if (hasRestoreOffer) {
      adPendingRef.current = true;
      setRestoreModalOpen(true);
      return;
    }
    if (!checkedInToday) {
      setDoubleLoading(true);
      const claimed = await claim();
      setDoubleLoading(false);
      if (!claimed) return;
    }
    await playDoubleAd();
  }

  async function handleRestoreResolved() {
    onUpdated?.();
    if (adPendingRef.current) {
      adPendingRef.current = false;
      await playDoubleAd();
    }
  }

  async function handleStartAgain() {
    setLoading(true);
    const claimed = await claim();
    setLoading(false);
    if (claimed) await handleRestoreResolved();
  }

  const dayTiles = ladder.map((amount, index) => {
    const day = index + 1;
    const isToday = day === dayInWeek;
    const isPast = day < dayInWeek;
    return (
      <View
        key={day}
        style={[
          styles.dayTile,
          isToday && styles.dayTileToday,
          isPast && styles.dayTilePast,
          day === 7 && styles.dayTileSeventh,
        ]}>
        <Text
          numberOfLines={1}
          style={[
            type.captionStrong,
            { color: isToday ? colors.goldLight : isPast ? colors.stone : colors.mute, fontSize: 10 },
          ]}>
          {t('earn.day.label', { day })}
        </Text>
        <MaterialCommunityIcons
          name="diamond-stone"
          size={14}
          color={isToday ? colors.goldLight : colors.gold}
        />
        <Text style={[type.code, { color: colors.ink, fontSize: 11, fontWeight: '700' }]}>
          {`+${amount}`}
        </Text>
      </View>
    );
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(28,38,76,0.66)', 'rgba(8,13,30,0.92)']}
        style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.streakBadge}>
            <MaterialCommunityIcons name="fire" size={20} color={colors.goldLight} />
            <Text style={[type.headingSm, { color: colors.goldLight }]}>
              {streakDays > 0 ? t('earn.streak.count', { days: streakDays }) : t('earn.streak.start')}
            </Text>
          </View>
          {checkin ? (
            <Text style={[type.captionStrong, { color: colors.mute }]}>
              {t('earn.week.label', { week: checkin.weekNumber })}
            </Text>
          ) : null}
        </View>

        {nextMilestone ? (
          <View style={styles.milestoneBlock}>
            <ProgressBar value={milestoneProgress} />
            <Text style={[type.caption, { color: colors.mute }]}>
              {t('earn.milestone.next', { day: nextMilestone.day, bonus: nextMilestone.bonus })}
            </Text>
            <View style={styles.milestoneChips}>
              {milestones.map((item) => {
                const reached = streakDays >= item.day;
                const isNext = item.day === nextMilestone.day;
                return (
                  <View
                    key={item.day}
                    style={[
                      styles.milestoneChip,
                      reached && styles.milestoneChipReached,
                      isNext && styles.milestoneChipNext,
                    ]}>
                    <Text style={[type.code, { color: reached || isNext ? colors.goldLight : colors.mute, fontSize: 10 }]}>
                      {item.day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {hasRestoreOffer && restoreOffer ? (
          <View style={styles.restoreRow}>
            <Text style={[type.caption, { color: colors.goldLight, flex: 1 }]}>
              {t('earn.restore.cardTitle', { days: restoreOffer.streakToKeep })}
            </Text>
            <Button
              label={t('earn.restore.keepBtn')}
              variant="outline"
              size="md"
              noInterstitial
              onPress={() => {
                adPendingRef.current = false;
                setRestoreModalOpen(true);
              }}
              style={styles.keepStreakBtn}
            />
          </View>
        ) : null}

        {notice ? (
          <Text style={[type.caption, { color: colors.goldLight, textAlign: 'center' }]}>
            {notice}
          </Text>
        ) : null}

        <View style={styles.ladderGrid}>{dayTiles}</View>

        <View style={styles.actions}>
          {doubleRemaining > 0 ? (
            <Button
              label={t('earn.checkin.doubleBtn')}
              onPress={() => void handleDoubleCheckin()}
              loading={doubleLoading}
              disabled={doubleLoading || loading || deviceUsedToday}
              noInterstitial
              icon={<MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.onGold} />}
            />
          ) : null}

          <Button
            label={
              deviceUsedToday && !checkedInToday
                ? t('earn.checkin.deviceUsed')
                : checkedInToday
                  ? t('earn.checkin.claimed')
                  : t('earn.checkin.claimBtn')
            }
            variant={checkedInToday || deviceUsedToday ? 'outline' : 'primary'}
            onPress={() => void handleClaim()}
            disabled={checkedInToday || deviceUsedToday || loading || doubleLoading}
            loading={loading}
            noInterstitial
          />

          {secondsLeft !== null ? (
            <Text style={[type.code, { color: colors.mute, textAlign: 'center' }]}>
              {t('earn.countdown.reset', { time: formatCountdown(secondsLeft) })}
            </Text>
          ) : null}
        </View>
      </LinearGradient>

      <StreakRestoreModal
        visible={restoreModalOpen}
        offer={restoreOffer}
        onClose={() => setRestoreModalOpen(false)}
        onRestored={() => void handleRestoreResolved()}
        onStartAgain={() => void handleStartAgain()}
        onGetVip={() => {
          reopenWhenVipRef.current = true;
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
  milestoneBlock: {
    gap: spacing.xs,
  },
  milestoneChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  milestoneChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  milestoneChipReached: {
    backgroundColor: colors.goldWashStrong,
  },
  milestoneChipNext: {
    borderColor: colors.gold,
  },
  restoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
