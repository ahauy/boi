import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { enterReferralSchema } from '@palmsight/shared';

import Screen, { ScreenHeader } from '../components/Screen';
import Text from '../components/AppText';
import { Banner, Button, Input, TextLink } from '../components/ui';
import { errorMessageOf, validateForm } from '../lib/forms';
import { enterReferralCode } from '../lib/users';
import { useAuth } from '../state/auth';
import { colors, spacing, text as type } from '../theme';

export default function EnterReferralScreen() {
  const { refreshUser } = useAuth();
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
      // Backend đã trả message tiếng Việt cho từng trường hợp mã không hợp lệ
      setFailure(errorMessageOf(err, 'Không thể xử lý mã giới thiệu. Vui lòng kiểm tra lại.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        <ScreenHeader
          compact
          title="Nhập mã giới thiệu"
          right={<TextLink label="Bỏ qua" onPress={() => router.replace('/')} />}
        />
      }
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button label={busy ? 'Đang xử lý...' : 'Xác nhận mã'} onPress={submit} loading={busy} disabled={Boolean(success)} />
          <Button label="Bỏ qua" variant="ghost" onPress={() => router.replace('/')} />
        </View>
      }>
      <Input
        label="Mã giới thiệu"
        value={code}
        onChangeText={(next) => setCode(next.toUpperCase())}
        placeholder="K7QX4MZP"
        helper="Mã gồm 8 ký tự in hoa. Nhập mã để nhận ngay 1 credit."
        autoCapitalize="characters"
        maxLength={8}
        error={error}
      />

      {success ? <Banner variant="success" title={success} /> : null}
      {failure ? <Banner variant="error" title={failure} /> : null}

      <Text style={[type.caption, { color: colors.stone }]}>Bạn có thể nhập mã sau trong mục Hồ sơ.</Text>
    </Screen>
  );
}
