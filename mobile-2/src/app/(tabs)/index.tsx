import React, { useCallback, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CORE_READING_COST_GEM, ReadingStatus, type ReadingListItemDto } from '@palmsight/shared';

import HeaderCredits from '../../components/HeaderCredits';
import Screen from '../../components/Screen';
import Text from '../../components/AppText';
import CosmicHand from '../../components/CosmicHand';
import ReadingCard from '../../components/ReadingCard';
import ReadingSetupSheet from '../../components/ReadingSetupSheet';
import { Banner, Button, SectionLabel, TextLink } from '../../components/ui';
import NotEnoughSheet from '../../earn/not-enough-sheet';
import { hasBillingProducts } from '../../billing/billing-store';
import { triggerPaywall } from '../../premium/paywall-triggers';
import { useAuth } from '../../state/auth';
import { t, useI18n } from '../../i18n';
import { errorMessageOf } from '../../lib/forms';
import { haptic } from '../../lib/haptics';
import { fetchReadings } from '../../lib/readings';
import { colors, font, radius, shadow, spacing, text as type } from '../../theme';

export default function HomeScreen() {
  useI18n();
  const { user, refreshUser } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notEnoughOpen, setNotEnoughOpen] = useState(false);
  const [recent, setRecent] = useState<ReadingListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  const gemBalance = (user as any)?.credits ?? user?.creditBalance ?? 0;

  const loadRecent = useCallback(async () => {
    setLoading(true);
    try {
      // Màn này chỉ vẽ 2 thẻ, nên xin đúng 2 thay vì một trang 20 rồi cắt.
      const page = await fetchReadings(undefined, 2);
      setRecent(page.items.slice(0, 2));
      setFailure(null);
    } catch (error) {
      setFailure(errorMessageOf(error, t('home.loadRecentFailed')));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRecent();
      void refreshUser().catch(() => undefined);
    }, [loadRecent, refreshUser])
  );

  const greeting = greetingForHour(new Date().getHours());
  const { width, height } = useWindowDimensions();
  const compact = height < 720;
  const handSize = compact ? 112 : 158;

  function handleStartReadingPress() {
    haptic.tap();
    if (gemBalance < CORE_READING_COST_GEM) {
      setNotEnoughOpen(true);
      // Chỉ tự bật paywall khi có gói thật; không tự bật giá mẫu.
      if (hasBillingProducts() && !user?.vip?.active) {
        void triggerPaywall('out_of_currency');
      }
      return;
    }
    setSheetOpen(true);
  }

  return (
    <>
      <Screen
        contentStyle={{ paddingBottom: 120 }}
        header={
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ gap: 1 }}>
              <Text style={{ fontFamily: font.display, fontSize: 27, letterSpacing: 0.6, color: colors.ink }}>PalmSight</Text>
              <Text style={[type.eyebrow, { color: colors.stone, fontSize: 9.5, letterSpacing: 2.4 }]}>COSMIC EDITION</Text>
            </View>
            <HeaderCredits />
          </View>
        }>
        <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
          <Text style={[type.caption, { color: colors.mute }]}>{greeting}</Text>
          <Text style={[type.headingLg, { color: colors.ink, lineHeight: 36 }]}>{t('home.headline')}</Text>
        </View>

        <View style={{ borderRadius: radius['3xl'], overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder, ...shadow.violet }}>
          <LinearGradient
            colors={['rgba(124,108,246,0.44)', 'rgba(28,38,76,0.86)', 'rgba(8,13,30,0.98)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ padding: compact ? spacing.md : spacing.lg, gap: compact ? spacing.sm : spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
              <Text style={[type.eyebrow, { color: colors.goldLight, letterSpacing: 2.1 }]}>{t('home.eyebrow')}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.14)' }} />
            </View>

            <View style={{ alignItems: 'center', marginVertical: compact ? -spacing.md : -spacing.sm }}>
              <CosmicHand size={handSize} />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={[type.displayLg, compact && { fontSize: 28, lineHeight: 32 }, { color: colors.ink, textAlign: 'center' }]}>
                {t('home.heroLine1')}{'\n'}
                <Text style={{ fontFamily: font.displayItalic, color: colors.goldLight }}>{t('home.heroLine2')}</Text>
              </Text>
              <Text style={[type.caption, { color: colors.body, textAlign: 'center', lineHeight: 20 }]} numberOfLines={2}>
                {compact ? t('home.subtitleCompact') : t('home.subtitle')}
              </Text>
            </View>

            <Button
              label={t('home.start')}
              size="lg"
              onPress={handleStartReadingPress}
              icon={<MaterialCommunityIcons name="star-four-points" size={18} color={colors.onGold} />}
            />

            <Text style={[type.code, { color: colors.body, textAlign: 'center', fontSize: 9.5, lineHeight: 14 }]}>
              {t(compact ? 'home.costCompact' : 'home.costFull', { cost: CORE_READING_COST_GEM })}
            </Text>
          </LinearGradient>
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionLabel
            right={
              recent.length > 0 ? (
                <TextLink
                  label={t('home.viewAll')}
                  style={{ fontSize: 13, color: colors.goldLight }}
                  onPress={() => {
                    haptic.select();
                    router.navigate('/history');
                  }}
                />
              ) : undefined
            }>
            {t('home.recent')}
          </SectionLabel>

          {loading ? <HomeSkeleton /> : null}

          {!loading && failure ? (
            <Banner variant="error" title={failure} action={{ label: t('screen.retry'), onPress: () => void loadRecent() }} />
          ) : null}

          {!loading && !failure && recent.length === 0 ? (
            <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius['2xl'], backgroundColor: colors.glassFill }}>
              <Text style={{ fontFamily: font.display, fontSize: 30, color: colors.gold }}>✦</Text>
              <Text style={[type.bodyBold, { color: colors.ink }]}>{t('home.emptyTitle')}</Text>
              <Text style={[type.caption, { color: colors.mute, textAlign: 'center', maxWidth: 270 }]}>
                {t('home.emptyBody')}
              </Text>
            </View>
          ) : null}

          {!loading && recent.map((item) => <ReadingCard key={item.id} item={item} compact />)}

          {!loading && recent.some((item) => item.status === ReadingStatus.PROCESSING) ? (
            <Text style={[type.caption, { color: colors.warning, textAlign: 'center' }]}>{t('home.processing')}</Text>
          ) : null}
        </View>

        <View
          style={{
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius['2xl'],
            backgroundColor: colors.goldWash,
            padding: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="moon-waning-crescent" size={20} color={colors.goldLight} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.quote, { color: colors.goldLight, fontSize: 18, lineHeight: 24 }]}>{t('home.quote')}</Text>
            <Text style={[type.caption, { color: colors.mute }]}>{t('home.disclaimer')}</Text>
          </View>
        </View>
      </Screen>

      <ReadingSetupSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onStartScan={() => {
          setSheetOpen(false);
          router.push('/camera');
        }}
      />

      <NotEnoughSheet
        visible={notEnoughOpen}
        onClose={() => setNotEnoughOpen(false)}
        currentBalance={gemBalance}
        requiredGem={CORE_READING_COST_GEM}
        onEarned={() => {
          void refreshUser().catch(() => undefined);
          setNotEnoughOpen(false);
        }}
      />
    </>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ height: 100, borderRadius: radius.xl, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassBorder }} />
      <View style={{ height: 100, borderRadius: radius.xl, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassBorder }} />
    </View>
  );
}

function greetingForHour(hour: number): string {
  if (hour < 11) return t('home.greetMorning');
  if (hour < 18) return t('home.greetAfternoon');
  return t('home.greetEvening');
}
