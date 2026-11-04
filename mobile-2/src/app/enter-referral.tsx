import React, { useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { enterReferralSchema } from '@palmsight/shared';

import Screen, { ScreenHeader } from '../components/Screen';
import Text from '../components/AppText';
import { Banner, Button, Input } from '../components/ui';
import { errorCodeOf, errorMessageOf, validateForm } from '../lib/forms';
import { enterReferralCode } from '../lib/users';
import { useAuth } from '../state/auth';
import { colors, radius, spacing, text as type } from '../theme';
import { REFERRAL_AMOUNTS } from '../lib/format';
import { t, useI18n } from '../i18n';

export default function EnterReferralScreen() {
  useI18n();
  const { refreshUser, user } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const fieldErrors = await validateForm(enterReferralSchema, { code });
    setError(fieldErrors.code);
    if (Object.keys(fieldErrors).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      const result = await enterReferralCode(code.trim().toUpperCase());
      setSuccess(t('enterCode.success', { name: result.referrer.displayName, amount: result.creditsEarned }));
      await refreshUser();
    } catch (err) {
      const code = errorCodeOf(err);
      if (code === 'REFERRAL_NOT_ALLOWED') setFailure(t('enterCode.notAllowed'));
      else if (code === 'REFERRAL_DEVICE_USED') setFailure(t('enterCode.deviceUsed'));
      else if (code === 'REFERRAL_NETWORK_LIMIT') setFailure(t('enterCode.networkLimit'));
      else setFailure(errorMessageOf(err, t('enterCode.failed')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<ScreenHeader compact title={t('profile.enterCodeTitle')} onBack={() => router.back()} />}
      footer={
        success ? (
          <Button label="Xong" onPress={() => router.back()} size="lg" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Button label={busy ? t('enterCode.processing') : t('enterCode.confirm')} onPress={submit} loading={busy} size="lg" />
            <Button label={t('enterCode.skip')} variant="ghost" onPress={() => router.back()} />
          </View>
        )
      }>
      <LinearGradient colors={['rgba(124,108,246,0.3)', 'rgba(22,32,66,0.9)', 'rgba(8,13,30,0.96)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius['3xl'], borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.goldWash, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="ticket-percent-outline" size={30} color={colors.goldLight} />
        </View>
        <Text style={[type.displayLg, { color: colors.ink, textAlign: 'center' }]}>{t('enterCode.heading')}</Text>
        <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center' }]}>{t('enterCode.body', REFERRAL_AMOUNTS)}</Text>
      </LinearGradient>

      <Input
        label={t('enterCode.label')}
        value={code}
        onChangeText={(next) => setCode(next.toUpperCase())}
        placeholder="K7QX4MZP"
        helper={t('enterCode.helper')}
        autoCapitalize="characters"
        maxLength={8}
        error={error}
      />

      {success ? <Banner variant="success" title={success} /> : null}
      {success && user ? (
        <Text accessibilityLiveRegion="polite" style={[type.captionStrong, { color: colors.goldLight }]}>
          {t('enterCode.balance', { balance: user.creditBalance })}
        </Text>
      ) : null}
      {failure ? <Banner variant="error" title={failure} /> : null}

      <Text style={[type.caption, { color: colors.stone }]}>{t('enterCode.later')}</Text>
    </Screen>
  );
}
