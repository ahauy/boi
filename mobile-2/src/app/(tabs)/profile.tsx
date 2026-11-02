import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import HeaderCredits from '../../components/HeaderCredits';
import Screen, { ScreenHeader } from '../../components/Screen';
import Text from '../../components/AppText';
import { Banner, Card, SectionLabel, TextLink } from '../../components/ui';
import { haptic } from '../../lib/haptics';
import { useAuth } from '../../state/auth';
import { colors, font, radius, spacing, text as type } from '../../theme';

const MENU = [
  { key: 'wallet', icon: 'wallet-outline' as const, title: 'Ví credits', body: 'Số dư và lịch sử cộng trừ' },
  { key: 'referral', icon: 'gift-outline' as const, title: 'Giới thiệu bạn bè', body: 'Mời bạn, nhận +2 credits' },
] as const;

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!user) {
    return (
      <Screen header={<ScreenHeader compact title="Hồ sơ" right={<HeaderCredits />} />} avoidKeyboard={false}>
        <Banner variant="error" title="Không tải được thông tin." action={{ label: 'Thử lại', onPress: () => void refreshUser() }} />
      </Screen>
    );
  }

  async function copy(value: string, kind: 'id' | 'code') {
    await Clipboard.setStringAsync(value);
    haptic.select();
    if (kind === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1800);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  }

  return (
    <Screen contentStyle={{ paddingBottom: 120 }} header={<ScreenHeader eyebrow="Thiên cơ của bạn" title="Hồ sơ" right={<HeaderCredits />} />}>
      <LinearGradient colors={['rgba(124,108,246,0.3)', 'rgba(22,32,66,0.9)', 'rgba(8,13,30,0.96)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius['3xl'], borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={user.displayName} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[type.headingMd, { color: colors.ink }]} numberOfLines={1}>{user.isAnonymous ? 'Nhà chiêm tinh' : user.displayName}</Text>
            <Text style={[type.caption, { color: colors.mute }]}>
              {user.isAnonymous ? 'Phiên ẩn danh theo thiết bị' : user.email ?? 'Tài khoản PalmSight'}
            </Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: colors.glassBorder }} />

        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.caption, { color: colors.stone }]}>{`Mã tài khoản · ${user.id.slice(0, 12)}...`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Sao chép mã tài khoản" onPress={() => void copy(user.id, 'id')} hitSlop={8} style={{ minHeight: 34, justifyContent: 'center', alignSelf: 'flex-start' }}>
              <Text style={[type.captionStrong, { color: colors.goldLight, textDecorationLine: 'underline' }]}>{copiedId ? 'Đã chép!' : 'Sao chép mã'}</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sao chép mã giới thiệu"
            onPress={() => void copy(user.referralCode, 'code')}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
            <View style={{ borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.lg, backgroundColor: colors.goldWash, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'flex-end', gap: 1 }}>
              <Text style={[type.code, { color: colors.stone, fontSize: 9 }]}>MÃ GIỚI THIỆU</Text>
              <Text style={[type.code, { color: colors.goldLight, letterSpacing: 1.2 }]}>{copiedCode ? 'ĐÃ CHÉP' : user.referralCode}</Text>
            </View>
          </Pressable>
        </View>

        <Text style={[type.caption, { color: colors.mute }]}>
          {user.isAnonymous
            ? 'Bài bói, credits và lịch sử gắn với thiết bị này. Cài lại app hoặc đổi máy có thể mất dữ liệu.'
            : 'Bài bói, credits và lịch sử được lưu cùng tài khoản của bạn.'}
        </Text>
      </LinearGradient>

      <View style={{ gap: spacing.sm }}>
        <SectionLabel>CREDITS &amp; KẾT NỐI</SectionLabel>
        <Card style={{ gap: 0, padding: 0 }}>
          {MENU.map((item, index) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.body}`}
              onPress={() => {
                haptic.select();
                router.push(item.key === 'wallet' ? '/wallet' : '/referral');
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                minHeight: 68,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.glassBorder,
                opacity: pressed ? 0.75 : 1,
              })}>
              <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassFill, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name={item.icon} size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>{item.title}</Text>
                <Text style={[type.caption, { color: colors.mute }]}>{item.body}</Text>
              </View>
              {item.key === 'wallet' ? <Text style={[type.bodyBold, { color: colors.goldLight }]}>{user.creditBalance}</Text> : null}
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
            </Pressable>
          ))}

          {user.referral.canEnterCode ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nhập mã giới thiệu, nhận thêm 1 credit"
              onPress={() => {
                haptic.select();
                router.push('/enter-referral');
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                minHeight: 68,
                borderTopWidth: 1,
                borderTopColor: colors.glassBorder,
                opacity: pressed ? 0.75 : 1,
              })}>
              <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.goldWash, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="ticket-percent-outline" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.goldLight }]}>Nhập mã giới thiệu</Text>
                <Text style={[type.caption, { color: colors.mute }]}>Bạn nhận +1 credit, bạn bè nhận +2</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
            </Pressable>
          ) : user.referral.enteredCode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderTopWidth: 1, borderTopColor: colors.glassBorder }}>
              <MaterialCommunityIcons name="check-circle-outline" size={17} color={colors.success} />
              <Text style={[type.caption, { color: colors.success, flex: 1 }]}>{`Đã nhận mã: ${user.referral.enteredCode}`}</Text>
            </View>
          ) : null}
        </Card>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionLabel>DỮ LIỆU CỦA BẠN</SectionLabel>
        <Card style={{ gap: spacing.sm }}>
          <Text style={[type.caption, { color: colors.mute }]}>
            Yêu cầu xoá ảnh và dữ liệu được xử lý thủ công qua email, hoàn tất trong 30 ngày. Gửi kèm mã tài khoản để được hỗ trợ nhanh hơn.
          </Text>
          <TextLink label="Hướng dẫn xoá dữ liệu" onPress={() => void openDataDeletion()} />
        </Card>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold }} />
          <Text style={[type.eyebrow, { color: colors.stone, fontSize: 9.5, letterSpacing: 2.2 }]}>PALMSIGHT · COSMIC EDITION</Text>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold }} />
        </View>
        <Text style={[type.caption, { color: colors.stone, textAlign: 'center', maxWidth: 300 }]}>
          Kết quả bói chỉ mang tính giải trí, không thay thế tư vấn y tế, tài chính hay pháp lý.
        </Text>
      </View>
    </Screen>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? 'K').toUpperCase();
  return (
    <View
      style={{
        width: 66,
        height: 66,
        borderRadius: 33,
        borderWidth: 1,
        borderColor: colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceSoft,
        shadowColor: colors.gold,
        shadowOpacity: 0.24,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 0 },
      }}>
      <Text style={{ fontFamily: font.displayStrong, fontSize: 29, color: colors.goldLight }}>{initial}</Text>
      <Text style={{ position: 'absolute', right: 4, bottom: 6, fontFamily: font.display, fontSize: 10, color: colors.gold }}>✦</Text>
    </View>
  );
}

function openDataDeletion() {
  const webRoot = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');
  if (!webRoot) return Promise.resolve();
  return WebBrowser.openBrowserAsync(`${webRoot}/data-deletion`);
}
