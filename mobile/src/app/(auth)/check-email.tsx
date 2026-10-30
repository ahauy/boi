import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import Screen, { ScreenHeader } from '../../components/Screen';
import Text from '../../components/AppText';
import { Banner, Button, Card, TextLink } from '../../components/ui';
import { resendVerification } from '../../lib/authApi';
import { errorMessageOf } from '../../lib/forms';
import { colors, spacing, text as type } from '../../theme';

const STEPS = ['Mở email từ PalmSight', 'Bấm vào link xác thực', 'Quay lại app để đăng nhập'];
const RESEND_COOLDOWN_SECONDS = 60;

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [cooldown]);

  async function resend() {
    if (!email) return;
    setSending(true);
    setFailure(null);
    try {
      await resendVerification(email);
      setNotice('Đã gửi lại email xác minh thành công.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setFailure(
        errorMessageOf(error, 'Không thể gửi lại email vào lúc này. Vui lòng thử lại sau.')
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen
      header={
        <ScreenHeader
          eyebrow="Tín Hiệu Tinh Cầu"
          title="Kiểm tra hộp thư của bạn"
          subtitle={`Đã gửi link xác minh tới ${email ?? 'hộp thư của bạn'}. Link có hiệu lực trong 24 giờ.`}
        />
      }
      footer={
        <View style={{ gap: spacing.md }}>
          <Button label="Tôi đã xác minh xong" onPress={() => router.replace('/login')} />
          <Button
            label={sending ? 'Đang gửi...' : cooldown > 0 ? `Gửi lại sau (${cooldown}s)...` : 'Gửi lại email xác minh'}
            variant="outline"
            onPress={resend}
            disabled={cooldown > 0 || sending}
            loading={sending}
          />
        </View>
      }>
      <Card>
        <Text style={[type.headingSm, { color: colors.ink }]}>Làm theo 3 bước</Text>
        <View style={{ gap: spacing.sm }}>
          {STEPS.map((step, index) => (
            <Text key={step} style={[type.bodyMd, { color: colors.body }]}>
              {`${index + 1}. ${step}`}
            </Text>
          ))}
        </View>
      </Card>

      {notice ? <Banner variant="success" title={notice} /> : null}
      {failure ? <Banner variant="error" title={failure} /> : null}

      <Banner variant="info" title="Không thấy email? Kiểm tra thư mục Spam." />

      <TextLink label="Dùng email khác" onPress={() => router.push('/register')} />
    </Screen>
  );
}
