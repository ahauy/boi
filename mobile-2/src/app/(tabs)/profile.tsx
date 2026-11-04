import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import HeaderCredits from '../../components/HeaderCredits';
import Screen, { ScreenHeader } from '../../components/Screen';
import Text from '../../components/AppText';
import { Banner, Button, Card, SectionLabel, TextLink } from '../../components/ui';
import NativeAdSlot from '../../ads/native-ad-slot';
import {
  isMediationDebuggerEnabled,
  openMediationDebugger,
  showPrivacyOptions,
} from '../../ads/ads-service';
import { markNoInterstitialTap } from '../../ads/interstitial-policy';
import { triggerPaywall } from '../../premium/paywall-triggers';
import { SUPPORTED_LANGUAGES, SupportedLanguage, useI18n } from '../../i18n';
import { useAuth } from '../../state/auth';
import { colors, font, radius, shadow, spacing, text as type } from '../../theme';
import { haptic } from '../../lib/haptics';

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const { width } = useWindowDimensions();

  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);

  const isVip = Boolean((user as any)?.isVip || user?.vip?.active);
  const gemBalance = (user as any)?.credits ?? user?.creditBalance ?? 0;
  const currentLangSpec = SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? SUPPORTED_LANGUAGES[0];

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

  function handleOpenPaywall() {
    haptic.tap();
    markNoInterstitialTap();
    void triggerPaywall('settings_entry');
  }

  function handlePrivacyChoices() {
    haptic.select();
    void showPrivacyOptions();
  }

  function handleMediationDebugger() {
    haptic.select();
    openMediationDebugger();
  }

  return (
    <>
      <Screen contentStyle={{ paddingBottom: 130 }} header={<ScreenHeader eyebrow="Thiên cơ của bạn" title="Hồ sơ" right={<HeaderCredits />} />}>
        {/* User Card */}
        <LinearGradient colors={['rgba(124,108,246,0.3)', 'rgba(22,32,66,0.9)', 'rgba(8,13,30,0.96)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar name={user.displayName} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text style={[type.headingMd, { color: colors.ink }]} numberOfLines={1}>{user.isAnonymous ? 'Nhà chiêm tinh' : user.displayName}</Text>
                {isVip ? (
                  <View style={styles.vipTagSmall}>
                    <MaterialCommunityIcons name="crown" size={12} color={colors.onGold} />
                    <Text style={styles.vipTagSmallText}>VIP</Text>
                  </View>
                ) : null}
              </View>
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
              ? 'Bài bói, gems và lịch sử gắn với thiết bị này. Cài lại app hoặc đổi máy có thể mất dữ liệu.'
              : 'Bài bói, gems và lịch sử được lưu cùng tài khoản của bạn.'}
          </Text>
        </LinearGradient>

        {/* VIP Status or Upgrade Banner */}
        <LinearGradient
          colors={
            isVip
              ? ['rgba(231,199,119,0.22)', 'rgba(26,38,75,0.92)', 'rgba(8,13,30,0.98)']
              : ['rgba(124,108,246,0.3)', 'rgba(28,38,76,0.88)', 'rgba(8,13,30,0.96)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.vipBannerCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={styles.vipCrownCircle}>
              <MaterialCommunityIcons name="crown" size={24} color={colors.goldLight} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyBold, { color: colors.goldLight }]}>
                {isVip ? 'Hội viên VIP PalmSight' : 'Nâng cấp Hội Viên VIP'}
              </Text>
              <Text style={[type.caption, { color: colors.mute }]}>
                {isVip
                  ? 'Đang hoạt động: +50 GEM/ngày, mở khoá mọi trường phái, không quảng cáo biểu ngữ & xen kẽ'
                  : '50 GEM mỗi ngày, mở khoá trường phái Phương Đông & Vedic, không quảng cáo biểu ngữ & xen kẽ'}
              </Text>
            </View>
          </View>

          <Button
            label={isVip ? 'Quản lý gói VIP' : 'Nhận VIP ngay'}
            size="md"
            variant={isVip ? 'outline' : 'primary'}
            onPress={handleOpenPaywall}
            icon={<MaterialCommunityIcons name="crown" size={17} color={isVip ? colors.goldLight : colors.onGold} />}
          />
        </LinearGradient>

        {/* Resources & Connections */}
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>TÀI NGUYÊN &amp; KẾT NỐI</SectionLabel>
          <Card style={{ gap: 0, padding: 0 }}>
            {/* Currency Tab Row */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ví Gems, số dư và nhiệm vụ nhận thưởng"
              onPress={() => {
                haptic.select();
                router.push('/(tabs)/currency');
              }}
              style={({ pressed }) => [styles.menuRow, { borderTopWidth: 0, opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.menuIconCircle}>
                <MaterialCommunityIcons name="diamond-stone" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>Ví Gems &amp; Nhiệm vụ</Text>
                <Text style={[type.caption, { color: colors.mute }]}>Điểm danh, vòng quay và video nhận GEM</Text>
              </View>
              <Text style={[type.bodyBold, { color: colors.goldLight }]}>{`${gemBalance} GEM`}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
            </Pressable>

            {/* Referral Row */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Giới thiệu bạn bè, nhận +2 credits"
              onPress={() => {
                haptic.select();
                router.push('/referral');
              }}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.menuIconCircle}>
                <MaterialCommunityIcons name="gift-outline" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>Giới thiệu bạn bè</Text>
                <Text style={[type.caption, { color: colors.mute }]}>Mời bạn bè, nhận thêm phần thưởng</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
            </Pressable>

            {user.referral.canEnterCode ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nhập mã giới thiệu, nhận thêm 1 credit"
                onPress={() => {
                  haptic.select();
                  router.push('/enter-referral');
                }}
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}>
                <View style={[styles.menuIconCircle, { backgroundColor: colors.goldWash, borderColor: colors.hairline }]}>
                  <MaterialCommunityIcons name="ticket-percent-outline" size={19} color={colors.goldLight} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.bodyBold, { color: colors.goldLight }]}>Nhập mã giới thiệu</Text>
                  <Text style={[type.caption, { color: colors.mute }]}>Bạn nhận +1 credit, bạn bè nhận +2</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
              </Pressable>
            ) : user.referral.enteredCode ? (
              <View style={[styles.menuRow, { opacity: 1 }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={17} color={colors.success} />
                <Text style={[type.caption, { color: colors.success, flex: 1 }]}>{`Đã nhận mã: ${user.referral.enteredCode}`}</Text>
              </View>
            ) : null}
          </Card>
        </View>

        {/* Preferences & Settings */}
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>CÀI ĐẶT &amp; QUYỀN RIÊNG TƯ</SectionLabel>
          <Card style={{ gap: 0, padding: 0 }}>
            {/* Language Selector */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ngôn ngữ: ${currentLangSpec.nativeName}. Bấm để thay đổi.`}
              onPress={() => {
                haptic.select();
                setLangModalVisible(true);
              }}
              style={({ pressed }) => [styles.menuRow, { borderTopWidth: 0, opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.menuIconCircle}>
                <MaterialCommunityIcons name="translate" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>Ngôn ngữ ứng dụng</Text>
                <Text style={[type.caption, { color: colors.mute }]}>{`${currentLangSpec.flag} ${currentLangSpec.nativeName}`}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
            </Pressable>

            {/* Ad Privacy Choices */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tùy chọn quyền riêng tư quảng cáo"
              onPress={handlePrivacyChoices}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.menuIconCircle}>
                <MaterialCommunityIcons name="shield-account-outline" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>Quyền riêng tư quảng cáo</Text>
                <Text style={[type.caption, { color: colors.mute }]}>Quản lý đồng ý Google UMP &amp; MAX SDK</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
            </Pressable>

            {/* Mediation Debugger (dev/test builds only) */}
            {isMediationDebuggerEnabled() ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở MAX Mediation Debugger"
                onPress={handleMediationDebugger}
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}>
                <View style={[styles.menuIconCircle, { borderColor: colors.goldLight }]}>
                  <MaterialCommunityIcons name="bug-outline" size={19} color={colors.goldLight} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.bodyBold, { color: colors.goldLight }]}>Mediation Debugger</Text>
                  <Text style={[type.caption, { color: colors.mute }]}>Chẩn đoán mạng quảng cáo AppLovin MAX</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
              </Pressable>
            ) : null}
          </Card>
        </View>

        {/* Native Ad Slot */}
        <View style={styles.adSection}>
          <NativeAdSlot
            availableHeight={260}
            availableWidth={Math.max(300, width - spacing.xl * 2)}
            {...({ placement: 'profile' } as any)}
          />
        </View>

        {/* Data Deletion */}
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

      {/* Language Selection Modal */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <Pressable
          style={styles.modalScrim}
          onPress={() => setLangModalVisible(false)}
        >
          <Pressable style={styles.langModalContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.langModalHeader}>
              <Text style={[type.headingSm, { color: colors.ink }]}>Chọn ngôn ngữ</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setLangModalVisible(false)}
                style={styles.closeBtn}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {SUPPORTED_LANGUAGES.map((item) => {
                const selected = item.code === language;
                return (
                  <Pressable
                    key={item.code}
                    onPress={() => {
                      haptic.select();
                      void setLanguage(item.code);
                      setLangModalVisible(false);
                    }}
                    style={[styles.langOptionRow, selected && styles.langOptionRowActive]}
                  >
                    <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={[type.bodyBold, { color: selected ? colors.goldLight : colors.ink }]}>
                        {item.nativeName}
                      </Text>
                      <Text style={[type.caption, { color: colors.mute }]}>{item.code.toUpperCase()}</Text>
                    </View>
                    {selected ? (
                      <MaterialCommunityIcons name="check" size={20} color={colors.gold} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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

const styles = StyleSheet.create({
  userCard: {
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  vipTagSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  vipTagSmallText: {
    ...type.captionStrong,
    color: colors.onGold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  vipBannerCard: {
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  vipCrownCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.goldWashStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 68,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  menuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adSection: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(4,6,17,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  langModalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.canvas,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  langModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassFill,
  },
  langOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  langOptionRowActive: {
    backgroundColor: colors.goldWashStrong,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
});
