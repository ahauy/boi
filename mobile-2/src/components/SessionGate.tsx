import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from './AppText';
import { Button } from './ui';
import CosmicBackground from './CosmicBackground';
import CosmicHand from './CosmicHand';
import { useAuth } from '../state/auth';
import { colors, spacing, text as type } from '../theme';
import { t, useI18n } from '../i18n';

export function SessionLoadingScreen() {
  useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
      <CosmicBackground intensity={0.8} />
      <CosmicHand size={150} scan={false} />
      <ActivityIndicator color={colors.gold} />
      <Text style={[type.caption, { color: colors.stone }]}>{t('session.connecting')}</Text>
    </View>
  );
}

export function SessionErrorScreen() {
  useI18n();
  const { error, retry } = useAuth();
  const insets = useSafeAreaInsets();
  const [retrying, setRetrying] = useState(false);

  async function tryAgain() {
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <CosmicBackground />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}>
        <Text style={[type.eyebrow, { color: colors.gold, letterSpacing: 2.6 }]}>{t('session.eyebrow')}</Text>
        <CosmicHand size={210} scan={false} />
        <Text style={[type.displayLg, { color: colors.ink, textAlign: 'center' }]}>{t('session.failedTitle')}</Text>
        <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center', maxWidth: 320 }]} accessibilityLiveRegion="polite">
          {error ?? t('session.failedBody')}
        </Text>
        <Button label={t('screen.retry')} onPress={tryAgain} loading={retrying} style={{ minWidth: 200 }} />
        <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
          {t('session.hint')}
        </Text>
      </View>
    </View>
  );
}
