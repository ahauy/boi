import React, { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ReferralStatus, type ReferralListItemDto } from '@palmsight/shared';

import Screen, { ScreenHeader } from '../components/Screen';
import Text from '../components/AppText';
import { Banner, Button, Card, TextLink } from '../components/ui';
import { errorMessageOf } from '../lib/forms';
import { haptic } from '../lib/haptics';
import { formatDateTime, SHARE_TEXT_INTRO } from '../lib/format';
import { fetchReferrals } from '../lib/users';
import { useAuth } from '../state/auth';
import { colors, font, radius, spacing, text as type } from '../theme';

export default function ReferralScreen() {
  const { user } = useAuth();
  const [copied, setCopied] = useState<'code' | 'link' | 'text' | null>(null);
  const [invited, setInvited] = useState<ReferralListItemDto[]>([]);
  const [totals, setTotals] = useState({ totalRewarded: 0, totalCreditsEarned: 0 });
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    void fetchReferrals()
      .then((page) => {
        setInvited(page.items);
        setTotals({ totalRewarded: page.totalRewarded, totalCreditsEarned: page.totalCreditsEarned });
      })
      .catch((error) => setFailure(errorMessageOf(error, 'Không tải được danh sách người đã mời.')));
  }, []);

  async function copy(kind: 'code' | 'link' | 'text', value: string) {
    await Clipboard.setStringAsync(value);
    haptic.select();
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }

  async function share() {
    if (!user) return;
    try {
      await Share.share({ message: SHARE_TEXT_INTRO(user.referralCode) });
    } catch {
      // Một số trình duyệt/desktop không hỗ trợ Web Share: rơi về sao chép câu mời
      await Clipboard.setStringAsync(SHARE_TEXT_INTRO(user.referralCode));
      setCopied('text');
      setTimeout(() => setCopied(null), 1800);
    }
  }

  if (!user) return <Screen header={<ScreenHeader compact title="Giới thiệu bạn bè" />} avoidKeyboard={false} />;

  const code = user.referralCode;
  const link = user.referralLink;

  return (
    <Screen header={<ScreenHeader compact title="Giới thiệu bạn bè" onBack={() => router.back()} />}>
      <View style={{ borderRadius: radius['3xl'], overflow: 'hidden', borderWidth: 1, borderColor: colors.hairlineStrong }}>
        <LinearGradient colors={['rgba(231,199,119,0.28)', 'rgba(28,38,76,0.94)', 'rgba(8,13,30,0.98)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: spacing.lg, gap: spacing.lg, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <MaterialCommunityIcons name="gift-outline" size={15} color={colors.goldLight} />
            <Text style={[type.eyebrow, { color: colors.goldLight }]}>MÃ CỦA TÔI</Text>
          </View>

          <View style={{ borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.xl, backgroundColor: colors.glassFill, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center', alignSelf: 'stretch' }}>
            <Text
              accessibilityLabel={`Mã giới thiệu ${code}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={1.1}
              style={{ fontFamily: font.displayStrong, fontSize: 42, lineHeight: 48, color: colors.goldLight, letterSpacing: 5 }}>
              {code}
            </Text>
            <Text style={[type.caption, { color: colors.mute, textAlign: 'center' }]}>Chia sẻ mã này, mỗi người nhập bạn nhận +2 credits.</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
            <Button label={copied === 'code' ? 'Đã chép!' : 'Sao chép'} style={{ flex: 1 }} onPress={() => void copy('code', code)} icon={<MaterialCommunityIcons name="content-copy" size={16} color={colors.onGold} />} />
            <Button label="Chia sẻ" variant="outline" style={{ flex: 1 }} onPress={() => void share()} icon={<MaterialCommunityIcons name="share-variant-outline" size={16} color={colors.goldLight} />} />
          </View>
          <Text accessibilityLiveRegion="polite" style={[type.caption, { color: colors.success, textAlign: 'center', minHeight: 18, marginTop: -spacing.sm }]}>
            {copied ? 'Đã sao chép vào bộ nhớ tạm' : ' '}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
            <View style={{ alignItems: 'center', gap: 1 }}>
              <Text style={{ fontFamily: font.displayStrong, fontSize: 26, color: colors.ink }}>{totals.totalRewarded}</Text>
              <Text style={[type.code, { color: colors.stone, fontSize: 9 }]}>LƯỢT ĐƯỢC THƯỞNG</Text>
            </View>
            <View style={{ width: 1, height: 28, backgroundColor: colors.glassBorder }} />
            <View style={{ alignItems: 'center', gap: 1 }}>
              <Text style={{ fontFamily: font.displayStrong, fontSize: 26, color: colors.goldLight }}>+{totals.totalCreditsEarned}</Text>
              <Text style={[type.code, { color: colors.stone, fontSize: 9 }]}>CREDITS NHẬN ĐƯỢC</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <Card style={{ gap: spacing.sm }}>
        <Text style={[type.headingSm, { color: colors.ink }]}>Cách nhận credits</Text>
        {[
          'Mỗi người nhập mã của bạn, bạn nhận +2 credits',
          'Người được bạn mời nhận +1 credit khi nhập mã',
          'Tối đa 10 lượt thưởng mỗi ngày',
        ].map((line) => (
          <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <MaterialCommunityIcons name="check-circle-outline" size={15} color={colors.success} style={{ marginTop: 2 }} />
            <Text style={[type.caption, { color: colors.body, flex: 1 }]}>{line}</Text>
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: colors.glassBorder, marginVertical: spacing.xs }} />
        <TextLink label={copied === 'link' ? 'Đã chép liên kết!' : 'Sao chép liên kết mời'} onPress={() => void copy('link', link)} />
        <TextLink label={copied === 'text' ? 'Đã chép câu mời!' : 'Sao chép câu mời'} onPress={() => void copy('text', SHARE_TEXT_INTRO(code))} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
          <Text style={[type.headingSm, { color: colors.ink }]}>Người đã mời</Text>
          <Text style={[type.code, { color: colors.goldLight }]}>{`${invited.length} NGƯỜI`}</Text>
        </View>

        {failure ? <Banner variant="error" title={failure} /> : null}

        {invited.length === 0 && !failure ? (
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={32} color={colors.gold} />
            <Text style={[type.caption, { color: colors.mute, textAlign: 'center' }]}>
              Chưa có ai sử dụng mã giới thiệu của bạn. Hãy chia sẻ mã để nhận thêm credits!
            </Text>
          </View>
        ) : null}

        {invited.map((item) => (
          <View key={`${item.displayName}-${item.createdAt}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.glassBorder, paddingBottom: spacing.sm }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>{item.displayName}</Text>
              <Text style={[type.code, { color: colors.stone, fontSize: 10.5 }]}>{formatDateTime(item.createdAt)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
              <Text style={[type.captionStrong, { color: item.status === ReferralStatus.REWARDED ? colors.success : colors.warning, textAlign: 'right' }]}>
                {item.status === ReferralStatus.REWARDED ? `+${item.creditsEarned} credits` : 'Đã ghi nhận · hết lượt hôm nay'}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
