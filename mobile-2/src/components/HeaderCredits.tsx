import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Text from './AppText';
import { useAuth } from '../state/auth';
import { colors, font, radius, spacing, text as type } from '../theme';
import { t, useI18n } from '../i18n';
import { haptic } from '../lib/haptics';

/** Credits / Gems luôn hiện ở góc trên; bấm để mở ví gems. */
export default function HeaderCredits() {
  useI18n();
  const { user } = useAuth();
  if (!user) return null;

  const isVip = Boolean((user as any)?.isVip || user?.vip?.active);
  const gemCount = (user as any)?.credits ?? user.creditBalance ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(isVip ? 'credits.a11yVip' : 'credits.a11y', { count: gemCount })}
      onPress={() => {
        haptic.select();
        router.push('/(tabs)/currency');
      }}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <LinearGradient
        colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.035)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons accessible={false} name="diamond-stone" size={13} color={colors.goldLight} />
        </View>

        <Text maxFontSizeMultiplier={1.2} style={styles.gemText}>
          {`${gemCount} GEM`}
        </Text>

        {isVip ? (
          <View style={styles.vipTag}>
            <MaterialCommunityIcons accessible={false} name="crown" size={10} color={colors.onGold} />
            <Text accessible={false} style={styles.vipText}>VIP</Text>
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.full,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: 5,
    backgroundColor: colors.glassFill,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldWashStrong,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  gemText: {
    ...type.code,
    color: colors.goldLight,
    fontFamily: font.monoMedium,
    letterSpacing: 0.5,
    fontSize: 12,
  },
  vipTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.gold,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginLeft: 2,
  },
  vipText: {
    ...type.captionStrong,
    color: colors.onGold,
    fontSize: 9,
    letterSpacing: 0.5,
    lineHeight: 11,
  },
});
