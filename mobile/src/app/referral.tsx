import React, { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ReferralStatus, type ReferralListItemDto } from '@palmsight/shared';

import Screen, { ScreenHeader } from '../components/Screen';
import Text from '../components/AppText';
import { Banner, Button, Card } from '../components/ui';
import MysticDivider from '../components/mystic/MysticDivider';
import { errorMessageOf } from '../lib/forms';
import { formatDateTime, SHARE_TEXT_INTRO } from '../lib/format';
import { fetchReferrals } from '../lib/users';
import { useAuth } from '../state/auth';
import { colors, radius, spacing, text as type } from '../theme';

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
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  function share() {
    if (!user) return;
    void Share.share({ message: SHARE_TEXT_INTRO(user.referralCode) });
  }

  if (!user) return <Screen header={<ScreenHeader compact title="Giới thiệu bạn bè" />} avoidKeyboard={false} />;

  const code = user.referralCode;
  const link = user.referralLink;

  return (
    <Screen
      header={<ScreenHeader compact title="Giới thiệu bạn bè" onBack={() => router.back()} />}>
      <Card ornate glow style={{ gap: spacing.md }}>
        <Text style={[type.eyebrow, { color: colors.gold }]}>MÃ CỦA TÔI</Text>
        <View style={{ borderWidth: 1, borderColor: colors.goldStrong, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceSoft }}>
          <Text
            accessibilityLabel={`Mã giới thiệu ${code}`}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            maxFontSizeMultiplier={1.1}
            style={[type.displayXl, { color: colors.gold, letterSpacing: 4 }]}>
            {code}
          </Text>
        </View>
        <MysticDivider compact symbol="✦ ☽ ☾" />

        <View style={{ gap: spacing.sm }}>
          <Button label={copied === 'code' ? 'Đã chép!' : 'Sao chép mã'} onPress={() => void copy('code', code)} />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button label={copied === 'link' ? 'Đã chép liên kết!' : 'Sao chép liên kết'} variant="outline" style={{ flex: 1 }} onPress={() => void copy('link', link)} />
            <Button label="Chia sẻ" variant="outline" style={{ flex: 1 }} onPress={share} />
          </View>
          <Button label={copied === 'text' ? 'Đã chép câu mời!' : 'Sao chép câu mời'} variant="ghost" onPress={() => void copy('text', SHARE_TEXT_INTRO(code))} />
        </View>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text style={[type.headingSm, { color: colors.ink }]}>Cách nhận credits</Text>
        <Text style={[type.caption, { color: colors.success }]}>Mỗi người nhập mã của bạn, bạn nhận +2 credits</Text>
        <Text style={[type.caption, { color: colors.success }]}>Tối đa 10 lượt thưởng mỗi ngày</Text>
        <Text style={[type.caption, { color: colors.success }]}>Người được bạn mời nhận +1 credit khi nhập mã của bạn</Text>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[type.headingSm, { color: colors.ink }]}>Người đã mời</Text>
          <Text style={[type.code, { color: colors.gold }]}>{`${totals.totalRewarded} lượt được thưởng · +${totals.totalCreditsEarned} credits`}</Text>
        </View>

        {failure ? <Banner variant="error" title={failure} /> : null}

        {invited.length === 0 && !failure ? (
          <Text style={[type.caption, { color: colors.mute }]}>
            Chưa có ai sử dụng mã giới thiệu của bạn. Hãy chia sẻ mã để nhận thêm credits!
          </Text>
        ) : null}

        {invited.map((item) => (
          <View key={`${item.displayName}-${item.createdAt}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft, paddingBottom: spacing.sm }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: colors.ink }]} numberOfLines={1}>{item.displayName}</Text>
              <Text style={[type.code, { color: colors.stone }]}>{formatDateTime(item.createdAt)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={[type.bodyStrong, { color: item.status === ReferralStatus.REWARDED ? colors.success : colors.warning }]}>
                {item.status === ReferralStatus.REWARDED ? `+${item.creditsEarned} credits` : 'Đã ghi nhận · không cộng (hết lượt hôm nay)'}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
