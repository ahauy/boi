import React, { useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

import HeaderCredits from '../../components/HeaderCredits';
import Screen, { ScreenHeader } from '../../components/Screen';
import Text from '../../components/AppText';
import { Banner, Button, Card, TextLink } from '../../components/ui';
import { useAuth } from '../../state/auth';
import { colors, font, spacing, text as type } from '../../theme';

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const [copiedId, setCopiedId] = useState(false);

  if (!user) {
    return (
      <Screen header={<ScreenHeader compact title="Hồ sơ" />} avoidKeyboard={false}>
        <Banner variant="error" title="Không tải được thông tin." action={{ label: 'Thử lại', onPress: () => void refreshUser() }} />
      </Screen>
    );
  }

  return (
    <Screen header={<ScreenHeader compact title="Hồ sơ" right={<HeaderCredits />} />}>
      <Card ornate style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={user.displayName} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[type.headingMd, { color: colors.ink }]}>{user.isAnonymous ? 'Khách' : user.displayName}</Text>
            <Text style={[type.caption, { color: colors.mute }]}>
              {user.isAnonymous ? 'Không cần tài khoản hay mật khẩu' : user.email ?? 'Tài khoản PalmSight'}
            </Text>
          </View>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.hairlineStrong,
              borderRadius: 999,
              backgroundColor: colors.goldWash,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
            }}>
            <Text style={[type.code, { color: colors.goldLight }]}>{`${user.creditBalance} CREDITS`}</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: colors.hairlineSoft }} />
        <Text style={[type.caption, { color: colors.stone }]}>
          {user.isAnonymous
            ? 'Bài bói, credits và lịch sử được gắn với thiết bị này. Cài lại app hoặc đổi máy có thể mất dữ liệu.'
            : 'Bài bói, credits và lịch sử được lưu cùng tài khoản của bạn.'}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Text style={[type.code, { color: colors.stone, flexShrink: 1 }]} numberOfLines={1}>{`Mã tài khoản · ${user.id}`}</Text>
          <TextLink
            label={copiedId ? 'Đã chép!' : 'Sao chép'}
            onPress={async () => {
              await Clipboard.setStringAsync(user.id);
              setCopiedId(true);
              setTimeout(() => setCopiedId(false), 2000);
            }}
          />
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

      <Card style={{ gap: spacing.sm }}>
        <Text style={[type.headingSm, { color: colors.ink }]}>Dữ liệu của bạn</Text>
        <Text style={[type.caption, { color: colors.mute }]}>
          Yêu cầu xoá ảnh và dữ liệu được xử lý thủ công qua email, hoàn tất trong 30 ngày. Gửi kèm mã tài khoản ở trên để được hỗ trợ nhanh hơn.
        </Text>
        <Button label="Hướng dẫn xoá dữ liệu" variant="ghost" onPress={() => void openDataDeletion()} />
      </Card>
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
  const initial = (name.trim()[0] ?? 'K').toUpperCase();
  return (
    <View
      style={{
        width: 62,
        height: 62,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceSoft,
        shadowColor: colors.gold,
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      }}>
      <Text style={{ fontFamily: font.displayStrong, fontSize: 28, color: colors.gold }}>{initial}</Text>
    </View>
  );
}
