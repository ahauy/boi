import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import HeaderCredits from '../../components/HeaderCredits';
import Screen, { ScreenHeader } from '../../components/Screen';
import Text from '../../components/AppText';
import { Button, Card } from '../../components/ui';
import CheckinCard from '../../earn/checkin-card';
import LuckyWheel from '../../earn/lucky-wheel';
import { fetchCurrencyEarn } from '../../earn/earn-api';
import { CORE_READING_COST_GEM, ECONOMY_DEFAULTS } from '@palmsight/shared';
import type { CurrencyEarnResponseDto } from '@palmsight/shared';
import { markNoInterstitialTap } from '../../ads/interstitial-policy';
import { triggerPaywall } from '../../premium/paywall-triggers';
import { useBillingStore } from '../../billing';
import { useAuth } from '../../state/auth';
import { t, useI18n } from '../../i18n';
import { colors, font, radius, shadow, spacing, text as type } from '../../theme';
import { haptic } from '../../lib/haptics';

const SEGMENTS = ['checkin', 'wheel'] as const;
type Segment = (typeof SEGMENTS)[number];

export default function CurrencyScreen() {
  const { user, refreshUser } = useAuth();
  useI18n();
  const params = useLocalSearchParams<{ segment?: Segment }>();

  const isVip = Boolean(user?.vip?.active);
  const { billingEnabled } = useBillingStore();
  const gemBalance = user?.creditBalance ?? 0;

  const [earnState, setEarnState] = useState<CurrencyEarnResponseDto | null>(null);
  const [segment, setSegment] = useState<Segment>('checkin');

  useFocusEffect(
    useCallback(() => {
      if (params.segment && SEGMENTS.includes(params.segment)) setSegment(params.segment);
    }, [params.segment])
  );

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

  const handleEarnUpdated = useCallback(() => {
    void loadEarnState();
    void refreshUser().catch(() => undefined);
  }, [loadEarnState, refreshUser]);

  function handleVipPromoPress() {
    haptic.tap();
    markNoInterstitialTap();
    void triggerPaywall('manual');
  }

  return (
    <Screen
      contentStyle={{ paddingBottom: 130 }}
      header={
        <ScreenHeader
          eyebrow={t('gems.eyebrow')}
          title={t('gems.title')}
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
              {t('gems.balance')}
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
          {t('gems.body', { cost: CORE_READING_COST_GEM })}
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
                {t('gems.vipActive')}
              </Text>
              <Text style={[type.caption, { color: colors.mute }]}>
                {t('gems.vipDaily', { amount: ECONOMY_DEFAULTS.VIP_DAILY })} {t('paywall.benefit.noBannerInterstitial')}.
              </Text>
            </View>
          </View>
        </Card>
      ) : billingEnabled ? (
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
              <Text style={[type.headingSm, { color: colors.ink }]}>{t('gems.vipTitle')}</Text>
              <Text style={[type.caption, { color: colors.mute }]}>
                {t('gems.vipBody', { amount: ECONOMY_DEFAULTS.VIP_DAILY })}
              </Text>
            </View>
          </View>

          <Button
            label={t('gems.upgrade')}
            size="md"
            onPress={handleVipPromoPress}
            icon={<MaterialCommunityIcons name="crown" size={18} color={colors.onGold} />}
          />
        </LinearGradient>
      ) : null}

      {/* 3. Segmented control (§7.4) */}
      <View style={styles.segmentedControl} accessibilityRole="tablist">
        {SEGMENTS.map((key) => {
          const selected = segment === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => {
                haptic.select();
                setSegment(key);
              }}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[type.captionStrong, { color: selected ? colors.onGold : colors.mute }]}>
                {t(`earn.segment.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {segment === 'checkin' ? (
        <CheckinCard earnState={earnState} onUpdated={handleEarnUpdated} />
      ) : (
        <LuckyWheel earnState={earnState} onUpdated={handleEarnUpdated} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmentedControl: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  segmentSelected: {
    backgroundColor: colors.gold,
  },
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
