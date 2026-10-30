import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { forgotPasswordSchema } from '@palmsight/shared';

import Screen, { ScreenHeader } from '../../components/Screen';
import { Banner, Button, Input, LinkFooter } from '../../components/ui';
import { forgotPassword } from '../../lib/authApi';
import { errorMessageOf, validateForm } from '../../lib/forms';
import { spacing } from '../../theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const fieldErrors = await validateForm(forgotPasswordSchema, { email });
    setError(fieldErrors.email);
    if (Object.keys(fieldErrors).length > 0) return;

    setBusy(true);
    setFailure(null);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (error_) {
      setFailure(errorMessageOf(error_, 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        <ScreenHeader
          eyebrow="Khôi Phục Bí Mật"
          title="Quên mật khẩu"
          subtitle="Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu."
        />
      }
      footer={
        <View style={{ gap: spacing.md }}>
          <Button label="Tiếp tục" onPress={submit} loading={busy} disabled={sent} />
          <LinkFooter question="Đã có tài khoản?" action="Đăng nhập" onPress={() => router.replace('/login')} />
        </View>
      }>
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="your-email@gmail.com"
        keyboardType="email-address"
        autoComplete="email"
        error={error}
      />

      {sent ? (
        <Banner
          variant="success"
          title="Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi."
          lines={['Mở link bằng trình duyệt để đặt mật khẩu mới, sau đó quay lại app đăng nhập.']}
        />
      ) : null}
      {failure ? <Banner variant="error" title={failure} /> : null}
    </Screen>
  );
}
