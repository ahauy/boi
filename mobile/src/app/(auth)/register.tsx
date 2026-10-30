import React, { useRef, useState } from 'react';
import { View, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { registerFormSchema } from '@palmsight/shared';

import Screen, { ScreenHeader } from '../../components/Screen';
import Text from '../../components/AppText';
import { Banner, Button, Checkbox, Input, LinkFooter, TextLink } from '../../components/ui';
import { register } from '../../lib/authApi';
import { errorMessageOf, validateForm } from '../../lib/forms';
import { ApiError } from '../../lib/api';
import { colors, spacing, text as type } from '../../theme';

const PERK_LINE = '1 lượt xem = 1 credit, 3 trường phái, xoá dữ liệu theo yêu cầu.';

function openLegal(path: 'terms' | 'privacy') {
  const webRoot = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');
  if (!webRoot) return;
  void WebBrowser.openBrowserAsync(`${webRoot}/${path}`);
}

export default function RegisterScreen() {
  // Có claimToken nghĩa là user đi từ bài bói thử: backend gắn nó vào pending user để lưu bài sau khi xác minh email
  const { claimToken } = useLocalSearchParams<{ claimToken?: string }>();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(setter: React.Dispatch<React.SetStateAction<string>>) {
    return (value: string) => {
      setter(value);
      setErrors({});
      setFailure(null);
    };
  }

  async function submit() {
    const fieldErrors = await validateForm(registerFormSchema, {
      displayName,
      username,
      email,
      password,
      confirmPassword,
      referralCode: referralCode.trim(),
    });
    if (!agreed) fieldErrors.agreement = 'Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách riêng tư.';
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      const onlyAgreementError = Object.keys(fieldErrors).length === 1 && Boolean(fieldErrors.agreement);
      scrollRef.current?.scrollTo({ y: onlyAgreementError ? 10_000 : 0, animated: true });
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      const created = await register({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        referralCode: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
        claimToken,
      });
      router.push({ pathname: '/check-email', params: { email: created.email } });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields);
      } else {
        setFailure(
          errorMessageOf(error, 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.')
        );
      }
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      scrollRef={scrollRef}
      header={
        <ScreenHeader
          eyebrow="Khởi Tạo Duyên Mệnh"
          title="Tạo tài khoản"
          subtitle="Xác thực email để nhận 3 credits."
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/onboarding'))}
        />
      }
      footer={
        <View style={{ gap: spacing.md }}>
          <Button label={busy ? 'Đang đăng ký...' : 'Tạo tài khoản'} onPress={submit} loading={busy} />
          <LinkFooter
            question="Đã có tài khoản?"
            action="Đăng nhập"
            onPress={() =>
              router.replace(claimToken ? { pathname: '/login', params: { claimToken } } : '/login')
            }
          />
        </View>
      }>
      <View style={{ gap: spacing.lg }}>
        {claimToken ? (
          <Banner
            variant="info"
            title="Bài bói thử sẽ được lưu vào tài khoản này"
            lines={['Sau khi xác minh email, bài bói thử của bạn được chuyển thành bài bói chính thức.']}
          />
        ) : null}

        {failure ? <Banner variant="error" title={failure} /> : null}

        <Text style={[type.caption, { color: colors.mute }]}>{PERK_LINE}</Text>

        <Text style={[type.code, { color: colors.stone }]}>THÔNG TIN TÀI KHOẢN</Text>
        <Input label="Tên hiển thị" value={displayName} onChangeText={update(setDisplayName)} placeholder="Nguyễn Văn A" helper="Tên hiển thị trên hồ sơ của bạn." error={errors.displayName} autoCapitalize="words" autoComplete="name" />
        <Input label="Tên đăng nhập" value={username} onChangeText={update(setUsername)} placeholder="minhanh" helper="3-20 ký tự: chữ thường không dấu, số và dấu gạch dưới." error={errors.username} />
        <Input label="Email" value={email} onChangeText={update(setEmail)} placeholder="minhanh@example.com" helper="Chúng tôi gửi link xác thực tới email này." error={errors.email} keyboardType="email-address" autoComplete="email" />

        <Text style={[type.code, { color: colors.stone }]}>MẬT KHẨU</Text>
        <Input label="Mật khẩu" value={password} onChangeText={update(setPassword)} placeholder="••••••••" helper="Tối thiểu 8 ký tự." secure error={errors.password} autoComplete="new-password" />
        <Input label="Xác nhận mật khẩu" value={confirmPassword} onChangeText={update(setConfirmPassword)} placeholder="••••••••" secure error={errors.confirmPassword} autoComplete="new-password" />

        <Text style={[type.code, { color: colors.stone }]}>GIỚI THIỆU (KHÔNG BẮT BUỘC)</Text>
        <Input label="Mã giới thiệu" value={referralCode} onChangeText={update(setReferralCode)} placeholder="K7QX4MZP" helper="Mã từ liên kết mời. Bạn có thể sửa hoặc xoá." error={errors.referralCode} autoCapitalize="characters" />

        <Checkbox
          label="Tôi đồng ý với các điều khoản và chính sách của PalmSight."
          checked={agreed}
          onChange={(next) => {
            setAgreed(next);
            setErrors({});
          }}
          error={errors.agreement}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginLeft: 30 }}>
          <TextLink label="Điều khoản dịch vụ" onPress={() => openLegal('terms')} />
          <TextLink label="Chính sách riêng tư" onPress={() => openLegal('privacy')} />
        </View>
      </View>
    </Screen>
  );
}
