import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Text from './AppText';
import { useAuth } from '../state/auth';
import { colors, font, radius, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

/** Credits luôn hiện ở góc trên (web: nav badge `[n CREDITS]`); bấm để mở Ví credits. */
export default function HeaderCredits() {
  const { user } = useAuth();
  if (!user) return null;

  const creditWord = user.creditBalance === 1 ? 'CREDIT' : 'CREDITS';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${user.creditBalance} ${creditWord.toLowerCase()}, mở ví credits`}
      onPress={() => {
        haptic.select();
        router.push('/wallet');
      }}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.hairlineStrong,
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        backgroundColor: colors.goldWash,
        opacity: pressed ? 0.82 : 1,
      })}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
      <Text maxFontSizeMultiplier={1.2} style={[type.code, { color: colors.goldLight, letterSpacing: 1.1, fontFamily: font.monoMedium }]}>
        {`${user.creditBalance} ${creditWord}`}
      </Text>
    </Pressable>
  );
}
