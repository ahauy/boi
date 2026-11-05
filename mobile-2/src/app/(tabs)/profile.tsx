import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import HeaderCredits from '../../components/HeaderCredits';
import Screen, { ScreenHeader } from '../../components/Screen';
import Text from '../../components/AppText';
import { Banner, Button, Card, SectionLabel, TextLink } from '../../components/ui';
import {
  isMediationDebuggerEnabled,
  openMediationDebugger,
  showPrivacyOptions,
} from '../../ads/ads-service';
import { markNoInterstitialTap } from '../../ads/interstitial-policy';
import { useAdsStore } from '../../ads/ads-store';
import { triggerPaywall } from '../../premium/paywall-triggers';
import {
  billingStore,
  getBillingConfig,
  openSubscriptionManagement,
  useBillingStore,
} from '../../billing';
import { SUPPORTED_LANGUAGES, SupportedLanguage, t, useI18n } from '../../i18n';
import { REFERRAL_AMOUNTS, displayNameOf } from '../../lib/format';
import Avatar from '../../components/Avatar';
import { useAuth } from '../../state/auth';
import { colors, radius, shadow, spacing, text as type } from '../../theme';
import { haptic } from '../../lib/haptics';
import { openPrivacyPolicy } from '../../lib/open-privacy-policy';
import { openDataDeletion } from '../../lib/open-data-deletion';
import { openTerms } from '../../lib/open-terms';
import { endLocalSession } from '../../lib/api';
import { deleteAccount } from '../../lib/users';
import { deleteAccountErrorKey } from '../../lib/delete-account';

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { language, setLanguage } = useI18n();
  const { width } = useWindowDimensions();

  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [manageVipFailed, setManageVipFailed] = useState(false);
  const [privacyFailed, setPrivacyFailed] = useState(false);
  const [privacyPolicyFailed, setPrivacyPolicyFailed] = useState(false);
  const [termsFailed, setTermsFailed] = useState(false);
  const [dataDeletionFailed, setDataDeletionFailed] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountFailure, setDeleteAccountFailure] = useState<string | null>(null);
  const { billingEnabled, products } = useBillingStore();
  const { consentRegion } = useAdsStore();

  const isVip = Boolean((user as any)?.isVip || user?.vip?.active);
  const gemBalance = (user as any)?.credits ?? user?.creditBalance ?? 0;
  const vipProductId = user?.vip?.productId ?? null;
  const yearlyId = getBillingConfig().yearlyId;
  // Chỉ có nút khi bấm được: gói VIP đang hoạt động, hoặc billing đã bật để mở paywall
  const showVipCard = isVip || billingEnabled;
  const canUpgradeToYearly =
    isVip && billingEnabled && vipProductId !== yearlyId && Boolean(products[yearlyId]);
  // §5.6: chỉ người dùng vùng GDPR mới có form đổi lựa chọn quyền riêng tư quảng cáo
  const showPrivacyChoices = consentRegion === 'GDPR';
  const currentLangSpec = SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? SUPPORTED_LANGUAGES[0];

  if (!user) {
    return (
      <Screen header={<ScreenHeader compact title={t('profile.title')} right={<HeaderCredits />} />} avoidKeyboard={false}>
        <Banner variant="error" title={t('profile.loadFailed')} action={{ label: t('screen.retry'), onPress: () => void refreshUser() }} />
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

  function openEditProfile() {
    haptic.select();
    router.push('/edit-profile');
  }

  function handleOpenPaywall() {
    haptic.tap();
    markNoInterstitialTap();
    void triggerPaywall('settings_entry');
  }

  function handleUpgradeYearly() {
    haptic.tap();
    markNoInterstitialTap();
    void triggerPaywall('settings_vip');
  }

  async function handleManageVip() {
    haptic.tap();
    markNoInterstitialTap();
    setManageVipFailed(false);
    const result = await openSubscriptionManagement(vipProductId);
    if (!result.ok) setManageVipFailed(true);
  }

  async function handlePrivacyChoices() {
    haptic.select();
    setPrivacyFailed(false);
    const opened = await showPrivacyOptions();
    if (!opened) setPrivacyFailed(true);
  }

  async function handleOpenPrivacyPolicy() {
    haptic.select();
    markNoInterstitialTap();
    setPrivacyPolicyFailed(false);
    const opened = await openPrivacyPolicy();
    if (!opened) setPrivacyPolicyFailed(true);
  }

  async function handleOpenTerms() {
    haptic.select();
    markNoInterstitialTap();
    setTermsFailed(false);
    const opened = await openTerms();
    if (!opened) setTermsFailed(true);
  }

  async function handleOpenDataDeletion() {
    haptic.select();
    markNoInterstitialTap();
    setDataDeletionFailed(false);
    const opened = await openDataDeletion();
    if (!opened) setDataDeletionFailed(true);
  }

  function handleDeleteAccount() {
    haptic.select();
    markNoInterstitialTap();
    setDeleteAccountFailure(null);
    Alert.alert(t('profile.deleteAccountStep1Title'), t('profile.deleteAccountStep1Body', { gems: gemBalance }), [
      { text: t('reading.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccountContinue'),
        style: 'destructive',
        onPress: () => {
          markNoInterstitialTap();
          Alert.alert(t('profile.deleteAccountStep2Title'), t('profile.deleteAccountStep2Body'), [
            { text: t('reading.cancel'), style: 'cancel' },
            { text: t('profile.deleteAccountConfirm'), style: 'destructive', onPress: () => void performDeleteAccount() },
          ]);
        },
      },
    ]);
  }

  async function performDeleteAccount() {
    markNoInterstitialTap();
    setDeletingAccount(true);
    try {
      await deleteAccount();
      haptic.success();
      // Token cục bộ bị xoá; AuthProvider mở lại phiên khách mới. Về màn đầu để không còn dữ liệu cũ.
      endLocalSession();
      router.replace('/');
    } catch (error) {
      haptic.warning();
      setDeleteAccountFailure(t(deleteAccountErrorKey(error)));
    } finally {
      setDeletingAccount(false);
    }
  }

  function handleMediationDebugger() {
    haptic.select();
    openMediationDebugger();
  }

  return (
    <>
      <Screen contentStyle={{ paddingBottom: 130 }} header={<ScreenHeader eyebrow={t('profile.eyebrow')} title={t('profile.title')} right={<HeaderCredits />} />}>
        {/* User Card */}
        <LinearGradient colors={['rgba(124,108,246,0.3)', 'rgba(22,32,66,0.9)', 'rgba(8,13,30,0.96)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('editProfile.entry')} onPress={openEditProfile}>
              <Avatar name={displayNameOf(user)} uri={user.avatarUrl} />
            </Pressable>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text style={[type.headingMd, { color: colors.ink }]} numberOfLines={1}>{displayNameOf(user)}</Text>
                {isVip ? (
                  <View style={styles.vipTagSmall}>
                    <MaterialCommunityIcons name="crown" size={12} color={colors.onGold} />
                    <Text style={styles.vipTagSmallText}>VIP</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[type.caption, { color: colors.mute }]}>
                {user.isAnonymous ? t('profile.anonymousSession') : user.email ?? t('profile.account')}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('editProfile.entry')}
            onPress={openEditProfile}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, opacity: pressed ? 0.75 : 1 }]}>
            <MaterialCommunityIcons name="account-edit-outline" size={19} color={colors.goldLight} />
            <Text style={[type.bodyBold, { color: colors.goldLight, flex: 1 }]}>{t('editProfile.entry')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
          </Pressable>

          <View style={{ height: 1, backgroundColor: colors.glassBorder }} />

          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.caption, { color: colors.stone }]}>{t('profile.accountId', { id: user.id.slice(0, 12) })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('profile.copyAccountId')} onPress={() => void copy(user.id, 'id')} hitSlop={8} style={{ minHeight: 34, justifyContent: 'center', alignSelf: 'flex-start' }}>
                <Text style={[type.captionStrong, { color: colors.goldLight, textDecorationLine: 'underline' }]}>{copiedId ? t('profile.copied') : t('profile.copyId')}</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.copyReferral')}
              onPress={() => void copy(user.referralCode, 'code')}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
              <View style={{ borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.lg, backgroundColor: colors.goldWash, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'flex-end', gap: 1 }}>
                <Text style={[type.code, { color: colors.stone, fontSize: 9 }]}>{t('profile.referralCode')}</Text>
                <Text style={[type.code, { color: colors.goldLight, letterSpacing: 1.2 }]}>{copiedCode ? t('profile.copiedUpper') : user.referralCode}</Text>
              </View>
            </Pressable>
          </View>

          <Text style={[type.caption, { color: colors.mute }]}>
            {user.isAnonymous
              ? t('profile.dataDevice')
              : t('profile.dataAccount')}
          </Text>
        </LinearGradient>

        {/* VIP Status or Upgrade Banner */}
        {showVipCard ? (
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
                {isVip ? t('profile.vipMember') : t('profile.vipUpgrade')}
              </Text>
              <Text style={[type.caption, { color: colors.mute }]}>
                {isVip
                  ? t('profile.vipActiveBody')
                  : t('profile.vipOfferBody')}
              </Text>
            </View>
          </View>

          <Button
            label={isVip ? t('profile.manageVip') : t('profile.getVip')}
            size="md"
            variant={isVip ? 'outline' : 'primary'}
            onPress={isVip ? () => void handleManageVip() : handleOpenPaywall}
            icon={<MaterialCommunityIcons name="crown" size={17} color={isVip ? colors.goldLight : colors.onGold} />}
          />
          {canUpgradeToYearly ? (
            <Button label={t('profile.vipUpgradeYearly')} size="md" variant="primary" onPress={handleUpgradeYearly} />
          ) : null}
          {isVip && manageVipFailed ? <Banner variant="error" title={t('profile.manageVipFailed')} /> : null}
        </LinearGradient>
        ) : null}

        {/* Resources & Connections */}
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>{t('profile.sectionResources')}</SectionLabel>
          <Card style={{ gap: 0, padding: 0 }}>
            {/* Currency Tab Row */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.walletA11y')}
              onPress={() => {
                haptic.select();
                if (user?.vip?.active) {
                  router.push({ pathname: '/(tabs)/currency', params: { segment: 'wheel' } });
                } else if (billingStore.getState().billingEnabled) {
                  void triggerPaywall('settings_currency_row');
                } else {
                  router.push('/(tabs)/currency');
                }
              }}
              style={({ pressed }) => [styles.menuRow, { borderTopWidth: 0, opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.menuIconCircle}>
                <MaterialCommunityIcons name="diamond-stone" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>{t('profile.walletTitle')}</Text>
                <Text style={[type.caption, { color: colors.mute }]}>{t('profile.walletBody')}</Text>
              </View>
              <Text style={[type.bodyBold, { color: colors.goldLight }]}>{`${gemBalance} GEM`}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
            </Pressable>

            {/* Referral Row */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.referA11y', REFERRAL_AMOUNTS)}
              onPress={() => {
                haptic.select();
                router.push('/referral');
              }}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.menuIconCircle}>
                <MaterialCommunityIcons name="gift-outline" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>{t('profile.referTitle')}</Text>
                <Text style={[type.caption, { color: colors.mute }]}>{t('profile.referBody')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
            </Pressable>

            {user.referral.canEnterCode ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.enterCodeA11y', REFERRAL_AMOUNTS)}
                onPress={() => {
                  haptic.select();
                  router.push('/enter-referral');
                }}
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}>
                <View style={[styles.menuIconCircle, { backgroundColor: colors.goldWash, borderColor: colors.hairline }]}>
                  <MaterialCommunityIcons name="ticket-percent-outline" size={19} color={colors.goldLight} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.bodyBold, { color: colors.goldLight }]}>{t('profile.enterCodeTitle')}</Text>
                  <Text style={[type.caption, { color: colors.mute }]}>{t('profile.enterCodeBody', REFERRAL_AMOUNTS)}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
              </Pressable>
            ) : user.referral.enteredCode ? (
              <View style={[styles.menuRow, { opacity: 1 }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={17} color={colors.success} />
                <Text style={[type.caption, { color: colors.success, flex: 1 }]}>{t('profile.codeEntered', { code: user.referral.enteredCode ?? '' })}</Text>
              </View>
            ) : null}
          </Card>
        </View>

        {/* Preferences & Settings */}
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>{t('profile.sectionSettings')}</SectionLabel>
          <Card style={{ gap: 0, padding: 0 }}>
            {/* Language Selector */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.languageA11y', { language: currentLangSpec.nativeName })}
              onPress={() => {
                haptic.select();
                setLangModalVisible(true);
              }}
              style={({ pressed }) => [styles.menuRow, { borderTopWidth: 0, opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.menuIconCircle}>
                <MaterialCommunityIcons name="translate" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>{t('profile.language')}</Text>
                <Text style={[type.caption, { color: colors.mute }]}>{`${currentLangSpec.flag} ${currentLangSpec.nativeName}`}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
            </Pressable>

            {/* Ad Privacy Choices (chỉ GDPR, §5.6) */}
            {showPrivacyChoices ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.adPrivacyA11y')}
              onPress={() => void handlePrivacyChoices()}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.menuIconCircle}>
                <MaterialCommunityIcons name="shield-account-outline" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>{t('profile.adPrivacy')}</Text>
                <Text style={[type.caption, { color: colors.mute }]}>{t('profile.adPrivacyBody')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
            </Pressable>
            ) : null}
            {showPrivacyChoices && privacyFailed ? (
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                <Banner variant="error" title={t('profile.adPrivacyFailed')} />
              </View>
            ) : null}

            {/* Privacy policy (mở trình duyệt) */}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('profile.privacyPolicyA11y')}
              onPress={() => void handleOpenPrivacyPolicy()}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.menuIconCircle}>
                <MaterialCommunityIcons name="file-document-outline" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>{t('profile.privacyPolicy')}</Text>
                <Text style={[type.caption, { color: colors.mute }]}>{t('profile.privacyPolicyBody')}</Text>
              </View>
              <MaterialCommunityIcons name="open-in-new" size={18} color={colors.stone} />
            </Pressable>
            {privacyPolicyFailed ? (
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                <Banner variant="error" title={t('profile.privacyPolicyFailed')} />
              </View>
            ) : null}

            {/* Terms of service (mở trình duyệt) */}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('profile.termsA11y')}
              onPress={() => void handleOpenTerms()}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.menuIconCircle}>
                <MaterialCommunityIcons name="text-box-check-outline" size={19} color={colors.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyBold, { color: colors.ink }]}>{t('profile.terms')}</Text>
                <Text style={[type.caption, { color: colors.mute }]}>{t('profile.termsBody')}</Text>
              </View>
              <MaterialCommunityIcons name="open-in-new" size={18} color={colors.stone} />
            </Pressable>
            {termsFailed ? (
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                <Banner variant="error" title={t('profile.termsFailed')} />
              </View>
            ) : null}

            {/* Mediation Debugger (dev/test builds only) */}
            {isMediationDebuggerEnabled() ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.debuggerA11y')}
                onPress={handleMediationDebugger}
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}>
                <View style={[styles.menuIconCircle, { borderColor: colors.goldLight }]}>
                  <MaterialCommunityIcons name="bug-outline" size={19} color={colors.goldLight} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.bodyBold, { color: colors.goldLight }]}>Mediation Debugger</Text>
                  <Text style={[type.caption, { color: colors.mute }]}>{t('profile.debuggerBody')}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.stone} />
              </Pressable>
            ) : null}
          </Card>
        </View>

        {/* Data Deletion */}
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>{t('profile.sectionData')}</SectionLabel>
          <Card style={{ gap: spacing.sm }}>
            <Text style={[type.caption, { color: colors.mute }]}>
              {t('profile.dataDeletionBody')}
            </Text>
            <TextLink label={t('profile.dataDeletionLink')} onPress={() => void handleOpenDataDeletion()} />
            {dataDeletionFailed ? (
              <Banner variant="error" title={t('profile.dataDeletionFailed')} />
            ) : null}
            <Button
              label={deletingAccount ? t('profile.deleteAccountDeleting') : t('profile.deleteAccount')}
              accessibilityLabel={t('profile.deleteAccountA11y')}
              variant="danger"
              loading={deletingAccount}
              disabled={deletingAccount}
              noInterstitial
              onPress={handleDeleteAccount}
            />
            {deleteAccountFailure ? <Banner variant="error" title={deleteAccountFailure} /> : null}
          </Card>
        </View>

        <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold }} />
            <Text style={[type.eyebrow, { color: colors.stone, fontSize: 9.5, letterSpacing: 2.2 }]}>PALMSIGHT · COSMIC EDITION</Text>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold }} />
          </View>
          <Text style={[type.caption, { color: colors.stone, textAlign: 'center', maxWidth: 300 }]}>
            {t('profile.disclaimer')}
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
              <Text style={[type.headingSm, { color: colors.ink }]}>{t('profile.chooseLanguage')}</Text>
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
