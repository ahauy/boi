import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Text from './AppText';
import { useAuth } from '../state/auth';
import { colors, font, radius, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

/** Credits luôn hiện ở góc trên; bấm để mở ví credits. */
export default function HeaderCredits() {
  const { user } = useAuth();
  if (!user) return null;

  const creditWord = user.creditBalance === 1 ? 'credit' : 'credits';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${user.creditBalance} ${creditWord}, mở ví credits`}
      onPress={() => {
        haptic.select();
        router.push('/wallet');
      }}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <LinearGradient
        colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.035)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderRadius: radius.full,
          paddingLeft: spacing.sm,
          paddingRight: spacing.md,
          paddingVertical: 6,
          backgroundColor: colors.glassFill,
        }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.goldWashStrong,
            borderWidth: 1,
            borderColor: colors.hairlineStrong,
          }}>
          <MaterialCommunityIcons accessible={false} name="star-four-points" size={11} color={colors.goldLight} />
        </View>
        <Text maxFontSizeMultiplier={1.2} style={[type.code, { color: colors.goldLight, fontFamily: font.monoMedium, letterSpacing: 0.5 }]}>
          {`${user.creditBalance} ${creditWord}`}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
