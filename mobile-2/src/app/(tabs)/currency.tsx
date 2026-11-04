import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import HeaderCredits from '../../components/HeaderCredits';
import Screen, { ScreenHeader } from '../../components/Screen';
import Text from '../../components/AppText';
import { Banner, Button, Card, SectionLabel } from '../../components/ui';
import NativeAdSlot from '../../ads/native-ad-slot';
import CheckinCard from '../../earn/checkin-card';
import LuckyWheel from '../../earn/lucky-wheel';
import { fetchCurrencyEarn } from '../../earn/earn-api';
import type { CurrencyEarnResponseDto } from '@palmsight/shared';
import { getRewardedCooldownRemainingMs, watch } from '../../ads/rewarded';
import { markNoInterstitialTap } from '../../ads/interstitial-policy';
import { triggerPaywall } from '../../premium/paywall-triggers';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../i18n';
import { colors, font, radius, shadow, spacing, text as type } from '../../theme';
import { haptic } from '../../lib/haptics';

export const DOUBLE_TAP_GUARD_MS = 450;
const WATCH_AD_GEM_REWARD = 5;

export default function CurrencyScreen() {
  const { user, refreshUser } = useAuth();
  const { t } = useI18n();
  const { width } = useWindowDimensions();

  const isVip = Boolean((user as any)?.isVip || user?.vip?.active);
  const gemBalance = (user as any)?.credits ?? user?.creditBalance ?? 0;

  const [earnState, setEarnState] = useState<CurrencyEarnResponseDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [adMessage, setAdMessage] = useState<string | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);

  const lastTapRef = useRef<number>(0);

  const loadEarnState = useCallback(async () => {
    try {
      const res = await fetchCurrencyEarn();
      setEarnState(res);
    } catch {
      // Ignore load error
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEarnState();
      void refreshUser().catch(() => undefined);
    }, [loadEarnState, refreshUser])
  );

  // 10s cooldown timer polling for ad reward (§5.3)
  useEffect(() => {
    const timer = setInterval(() => {
      const rem = getRewardedCooldownRemainingMs();
      setCooldownRemainingMs(rem);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const bonusCounter = earnState?.rewarded?.bonus;
  const usedToday = bonusCounter?.usedToday ?? 0;
  const maxToday = bonusCounter?.cap ?? 5;
  const remainingToday = bonusCounter?.remaining ?? Math.max(0, maxToday - usedToday);
  const isCapReached = remainingToday <= 0;
  const isCooldownActive = cooldownRemainingMs > 0;

  async function handleWatchAd() {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_GUARD_MS) {
      return;
    }
    lastTapRef.current = now;

    if (adLoading || isCooldownActive || isCapReached) {
      return;
    }

    setAdLoading(true);
    setAdMessage(null);
    haptic.tap();

    try {
      const result = await watch('currency_tab', 'ad_reward');
      if (result.success) {
        haptic.success();
        await refreshUser().catch(() => undefined);
        await loadEarnState().catch(() => undefined);
        setAdMessage(`+${WATCH_AD_GEM_REWARD} GEM đã được cộng vào tài khoản!`);
        setTimeout(() => setAdMessage(null), 3000);
      }
    } catch (err: any) {
      haptic.warning();
      setAdMessage(err?.message ?? 'Không thể tải quảng cáo lúc này. Vui lòng thử lại sau.');
      setTimeout(() => setAdMessage(null), 3500);
    } finally {
      setAdLoading(false);
    }
  }

  function handleVipPromoPress() {
    haptic.tap();
    markNoInterstitialTap();
    void triggerPaywall('currency_tab_promo');
  }

  return (
    <Screen
      contentStyle={{ paddingBottom: 130 }}
      header={
        <ScreenHeader
          eyebrow="TÀI NGUYÊN & PHẦN THƯỞNG"
          title="Ví Gems"
          right={<HeaderCredits />}
        />
      }
    >
      {/* 1. Header Card: Current GEM Balance + VIP Badge */}
      <LinearGradient
        colors={['rgba(231,199,119,0.28)', 'rgba(26,38,75,0.92)', 'rgba(8,13,30,0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.balanceCard}
      >
        <View style={styles.balanceHeader}>
          <View style={styles.gemIconCircle}>
            <MaterialCommunityIcons name="diamond-stone" size={26} color={colors.goldLight} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.eyebrow, { color: colors.goldLight, letterSpacing: 2 }]}>
              SỐ DƯ KHẢ DỤNG
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={[type.displayLg, { color: colors.ink }]}>{gemBalance}</Text>
              <Text style={[type.headingSm, { color: colors.goldLight }]}>GEM</Text>
            </View>
          </View>
          {isVip ? (
            <View style={styles.vipTagActive}>
              <MaterialCommunityIcons name="crown" size={14} color={colors.onGold} />
              <Text style={styles.vipTagText}>VIP</Text>
            </View>
          ) : null}
        </View>

        <Text style={[type.caption, { color: colors.mute }]}>
          Mỗi quẻ đọc bài chỉ tay tiêu thụ 5 GEM. Bạn có thể điểm danh hoặc xem video để tích luỹ thêm.
        </Text>
      </LinearGradient>

      {/* 2. VIP Daily Grant Banner / CTA */}
      {isVip ? (
        <Card style={styles.vipGrantActiveCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={styles.vipCrownCircle}>
              <MaterialCommunityIcons name="crown" size={22} color={colors.goldLight} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyBold, { color: colors.goldLight }]}>
                Đặc quyền VIP đang hoạt động
              </Text>
              <Text style={[type.caption, { color: colors.mute }]}>
                +50 GEM tự động cộng mỗi ngày khi mở ứng dụng. Không quảng cáo chen ngang.
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <LinearGradient
          colors={['rgba(124,108,246,0.3)', 'rgba(28,38,76,0.85)', 'rgba(8,13,30,0.96)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.vipPromoCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={styles.vipPromoIcon}>
              <MaterialCommunityIcons name="star-shooting-outline" size={24} color={colors.goldLight} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.headingSm, { color: colors.ink }]}>Gói Hội Viên VIP</Text>
              <Text style={[type.caption, { color: colors.mute }]}>
                Nhận +50 GEM mỗi ngày, mở khoá toàn bộ trường phái, không quảng cáo biểu ngữ &amp; xen kẽ.
              </Text>
            </View>
          </View>

          <Button
            label="Nâng cấp VIP ngay"
            size="md"
            onPress={handleVipPromoPress}
            icon={<MaterialCommunityIcons name="crown" size={18} color={colors.onGold} />}
          />
        </LinearGradient>
      )}

      {/* 3. Daily Check-in Ladder */}
      <View style={{ gap: spacing.sm }}>
        <SectionLabel>ĐIỂM DANH HÀNG NGÀY</SectionLabel>
        <CheckinCard earnState={earnState} onUpdated={loadEarnState} />
      </View>

      {/* 4. Lucky Wheel */}
      <View style={{ gap: spacing.sm }}>
        <SectionLabel>VÒNG QUAY MAY MẮN</SectionLabel>
        <LuckyWheel earnState={earnState} onUpdated={loadEarnState} />
      </View>

      {/* 5. Watch Rewarded Ad Card (+5 GEM, 10s cooldown, daily cap) */}
      <View style={{ gap: spacing.sm }}>
        <SectionLabel
          right={
            <Text style={[type.code, { color: colors.goldLight }]}>
              {`${maxToday - remainingToday}/${maxToday} LẦN`}
            </Text>
          }
        >
          XEM QUẢNG CÁO NHẬN THƯỞNG
        </SectionLabel>

        <Card style={styles.watchAdCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={styles.adRewardIconCircle}>
              <MaterialCommunityIcons name="play-circle-outline" size={26} color={colors.goldLight} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>Xem video nhận GEM</Text>
                <View style={styles.bonusTag}>
                  <Text style={styles.bonusTagText}>{`+${WATCH_AD_GEM_REWARD} GEM`}</Text>
                </View>
              </View>
              <Text style={[type.caption, { color: colors.mute }]}>
                {isCapReached
                  ? 'Đã đạt giới hạn hôm nay. Hãy quay lại vào ngày mai!'
                  : isCooldownActive
                    ? `Vui lòng chờ ${Math.ceil(cooldownRemainingMs / 1000)}s giữa các lần xem`
                    : `Còn ${remainingToday} lượt nhận thưởng hôm nay (10s giãn cách)`}
              </Text>
            </View>
          </View>

          {adMessage ? (
            <Banner
              variant={adMessage.includes('+5') ? 'success' : 'warning'}
              title={adMessage}
            />
          ) : null}

          <Button
            label={
              adLoading
                ? 'Đang tải quảng cáo...'
                : isCooldownActive
                  ? `Chờ ${Math.ceil(cooldownRemainingMs / 1000)}s`
                  : isCapReached
                    ? 'Hết lượt hôm nay'
                    : `Xem video (+${WATCH_AD_GEM_REWARD} GEM)`
            }
            onPress={() => void handleWatchAd()}
            disabled={adLoading || isCooldownActive || isCapReached}
            loading={adLoading}
            variant={isCapReached ? 'outline' : 'primary'}
            icon={
              <MaterialCommunityIcons
                name="movie-open-play-outline"
                size={18}
                color={isCapReached ? colors.mute : colors.onGold}
              />
            }
          />
        </Card>
      </View>

      {/* 6. Native Ad Slot */}
      <View style={styles.adSection}>
        <NativeAdSlot
          availableHeight={280}
          availableWidth={Math.max(300, width - spacing.xl * 2)}
          {...({ placement: 'currency' } as any)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.violet,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  gemIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.goldWashStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipTagActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  vipTagText: {
    ...type.captionStrong,
    color: colors.onGold,
    fontSize: 11,
    letterSpacing: 1,
  },
  vipGrantActiveCard: {
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(231,199,119,0.08)',
    padding: spacing.md,
  },
  vipCrownCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.goldWashStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipPromoCard: {
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  vipPromoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchAdCard: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  adRewardIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.goldWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusTag: {
    backgroundColor: colors.goldWashStrong,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  bonusTagText: {
    ...type.captionStrong,
    color: colors.goldLight,
    fontSize: 11,
  },
  adSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
});
