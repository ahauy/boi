import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { AuthProvider, changePasswordSchema } from '@palmsight/shared';

import HeaderCredits from '../../components/HeaderCredits';
import Screen, { ScreenHeader } from '../../components/Screen';
import { Banner, Button, Card, Input, TextLink } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { errorMessageOf, validateForm } from '../../lib/forms';
import { changePassword } from '../../lib/users';
import { useAuth } from '../../state/auth';
import { colors, font, radius, spacing, text as type } from '../../theme';

const PROVIDER_LABEL: Record<AuthProvider, string> = {
  [AuthProvider.GOOGLE]: 'Google',
  [AuthProvider.FACEBOOK]: 'Facebook',
};

export default function AccountScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const userId = user?.id;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Screen header={<ScreenHeader compact title="Tài khoản" />} avoidKeyboard={false}>
        <Banner variant="error" title="Không tải được thông tin tài khoản." action={{ label: 'Thử lại', onPress: () => void refreshUser() }} />
      </Screen>
    );
  }

  async function copyId() {
    if (!userId) return;
    await Clipboard.setStringAsync(userId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  async function submitPassword() {
    const fieldErrors = await validateForm(changePasswordSchema, { currentPassword, newPassword, confirmPassword });
    if (newPassword.length >= 8 && confirmPassword !== newPassword) {
      fieldErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      await changePassword(currentPassword, newPassword);
      setNotice('Đổi mật khẩu thành công.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.code === 'CURRENT_PASSWORD_INCORRECT'
          ? 'Mật khẩu hiện tại không đúng'
          : errorMessageOf(error, 'Không thể đổi mật khẩu. Vui lòng thử lại.')
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Đăng xuất', 'Bạn muốn đăng xuất khỏi thiết bị này?', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen
      header={<ScreenHeader compact title="Tài khoản" right={<HeaderCredits />} />}>
      <Card ornate style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={user.displayName} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[type.headingMd, { color: colors.ink }]} numberOfLines={1}>{user.displayName || 'Người dùng'}</Text>
            <Text style={[type.caption, { color: colors.mute }]}>{user.username ? `@${user.username}` : 'Chưa có username'}</Text>
            <Text style={[type.caption, { color: colors.mute }]}>{user.email ?? 'Không có email'}</Text>
          </View>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.hairlineStrong,
              borderRadius: radius.full,
              backgroundColor: colors.goldWash,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
            }}>
            <Text style={[type.code, { color: colors.goldLight }]}>{`${user.creditBalance} CREDITS`}</Text>
          </View>
        </View>

        {user.email ? <Text style={[type.caption, { color: colors.success }]}>✓ Đã xác thực</Text> : null}
        {user.providers.length > 0 ? (
          <Text style={[type.caption, { color: colors.stone }]}>{`Đăng nhập bằng: ${user.providers.map((p) => PROVIDER_LABEL[p]).join(' · ')}`}</Text>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Text style={[type.code, { color: colors.stone, flexShrink: 1 }]} numberOfLines={1}>{`ID tài khoản · ${user.id}`}</Text>
          <TextLink label={copiedId ? 'Đã chép!' : 'Sao chép'} onPress={copyId} />
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[type.headingSm, { color: colors.ink }]}>Credits &amp; giới thiệu</Text>
        <Button label={`Ví credits · ${user.creditBalance} credits`} variant="outline" onPress={() => router.push('/wallet')} />
        <Button label="Giới thiệu bạn bè" variant="outline" onPress={() => router.push('/referral')} />
        {user.referral.canEnterCode ? (
          <Button label="Nhập mã giới thiệu (+1)" variant="ghost" onPress={() => router.push('/enter-referral')} />
        ) : user.referral.enteredCode ? (
          <Text style={[type.caption, { color: colors.success }]}>{`✓ Đã ghi nhận mã giới thiệu: ${user.referral.enteredCode}`}</Text>
        ) : null}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[type.headingSm, { color: colors.ink }]}>Bảo mật</Text>
        <Text style={[type.caption, { color: colors.mute }]}>Đổi mật khẩu định kỳ giúp bảo vệ tài khoản của bạn an toàn hơn.</Text>
        <Input label="Mật khẩu hiện tại" value={currentPassword} onChangeText={setCurrentPassword} placeholder="Nhập mật khẩu hiện tại" secure error={errors.currentPassword} autoComplete="current-password" />
        <Input label="Mật khẩu mới" value={newPassword} onChangeText={setNewPassword} placeholder="Tối thiểu 8 ký tự" secure error={errors.newPassword} autoComplete="new-password" />
        <Input label="Xác nhận mật khẩu" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Nhập lại mật khẩu mới" secure error={errors.confirmPassword} autoComplete="new-password" />
        {notice ? <Banner variant="success" title={notice} /> : null}
        {failure ? <Banner variant="error" title={failure} /> : null}
        <Button label={busy ? 'Đang đổi...' : 'Đổi mật khẩu'} onPress={submitPassword} loading={busy} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text style={[type.headingSm, { color: colors.ink }]}>Dữ liệu của bạn</Text>
        <Text style={[type.caption, { color: colors.mute }]}>
          Yêu cầu xoá ảnh và dữ liệu được xử lý thủ công qua email, hoàn tất trong 30 ngày.
        </Text>
        <Button label="Hướng dẫn xoá dữ liệu" variant="ghost" onPress={() => void openDataDeletion()} />
      </Card>

      <Button label="Đăng xuất" variant="danger" onPress={confirmSignOut} />
    </Screen>
  );
}

// Trang hướng dẫn xoá dữ liệu chỉ có trên web (không port) — mở bằng trình duyệt hệ thống
function openDataDeletion() {
  const webRoot = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');
  if (!webRoot) return Promise.resolve();
  return WebBrowser.openBrowserAsync(`${webRoot}/data-deletion`);
}

function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <View style={{ width: 62, height: 62, borderRadius: 999, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft, shadowColor: colors.gold, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }}>
      <Text style={{ fontFamily: font.displayStrong, fontSize: 28, color: colors.gold }}>{initial}</Text>
    </View>
  );
}
