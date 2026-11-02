import React, { useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { enterReferralSchema } from '@palmsight/shared';

import Screen, { ScreenHeader } from '../components/Screen';
import Text from '../components/AppText';
import { Banner, Button, Input } from '../components/ui';
import { errorMessageOf, validateForm } from '../lib/forms';
import { enterReferralCode } from '../lib/users';
import { useAuth } from '../state/auth';
import { colors, radius, spacing, text as type } from '../theme';

export default function EnterReferralScreen() {
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
      setSuccess(`Đã ghi nhận mã của ${result.referrer.displayName}. Bạn nhận được ${result.creditsEarned} credit!`);
      await refreshUser();
    } catch (err) {
      setFailure(errorMessageOf(err, 'Không thể xử lý mã giới thiệu. Vui lòng kiểm tra lại.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<ScreenHeader compact title="Nhập mã giới thiệu" onBack={() => router.back()} />}
      footer={
        success ? (
          <Button label="Xong" onPress={() => router.back()} size="lg" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Button label={busy ? 'Đang xử lý...' : 'Xác nhận mã'} onPress={submit} loading={busy} size="lg" />
            <Button label="Bỏ qua" variant="ghost" onPress={() => router.back()} />
          </View>
        )
      }>
      <LinearGradient colors={['rgba(124,108,246,0.3)', 'rgba(22,32,66,0.9)', 'rgba(8,13,30,0.96)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius['3xl'], borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.goldWash, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="ticket-percent-outline" size={30} color={colors.goldLight} />
        </View>
        <Text style={[type.displayLg, { color: colors.ink, textAlign: 'center' }]}>Nhập mã của bạn bè</Text>
        <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center' }]}>Bạn nhận ngay +1 credit. Người mời nhận +2 credits.</Text>
      </LinearGradient>

      <Input
        label="Mã giới thiệu"
        value={code}
        onChangeText={(next) => setCode(next.toUpperCase())}
        placeholder="K7QX4MZP"
        helper="Mã gồm 8 ký tự in hoa."
        autoCapitalize="characters"
        maxLength={8}
        error={error}
      />

      {success ? <Banner variant="success" title={success} /> : null}
      {success && user ? (
        <Text accessibilityLiveRegion="polite" style={[type.captionStrong, { color: colors.goldLight }]}>
          {`Số dư hiện tại: ${user.creditBalance} credits`}
        </Text>
      ) : null}
      {failure ? <Banner variant="error" title={failure} /> : null}

      <Text style={[type.caption, { color: colors.stone }]}>Bạn có thể nhập mã sau trong mục Hồ sơ.</Text>
    </Screen>
  );
}
