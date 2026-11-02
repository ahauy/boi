import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { RewardedAdPlacement, type RewardedAdAvailabilityDto } from '@palmsight/shared';

import Text from './AppText';
import { Banner, Button, Card } from './ui';
import { errorCodeOf, errorMessageOf } from '../lib/forms';
import { rewardedAdsSupported } from '../lib/ads';
import { earnRewardedCredit, fetchRewardedAvailability } from '../lib/rewardedAds';
import { useAuth } from '../state/auth';
import { colors, font, spacing, text as type } from '../theme';

type Phase = 'ready' | 'preparing' | 'watching' | 'confirming';

const PHASE_LABEL: Record<Phase, string> = {
  ready: 'Xem quảng cáo',
  preparing: 'Đang chuẩn bị...',
  watching: 'Đang mở quảng cáo...',
  confirming: 'Đang cộng credit...',
};

interface RewardedOfferProps {
  placement: RewardedAdPlacement;
  /** 'compact' dùng ở banner hết credit, nơi không đủ chỗ cho card đầy đủ. */
  variant?: 'card' | 'inline';
  onGranted?: (creditBalance: number) => void;
}

/**
 * Lời đề nghị "xem một quảng cáo để nhận một lượt bói".
 *
 * Chủ ý chỉ hiện khi backend bật cờ ads và còn lượt trong trần 24 giờ, nên người đang còn credit
 * không bao giờ thấy thành phần này. APP không tự cộng credit: sau khi SDK báo xem xong, app chỉ
 * đi hỏi backend — nguồn duy nhất của phần thưởng là callback đã Google ký.
 */
export default function RewardedOffer({ placement, variant = 'card', onGranted }: RewardedOfferProps) {
  const { setCreditBalance } = useAuth();
  const [availability, setAvailability] = useState<RewardedAdAvailabilityDto | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [notice, setNotice] = useState<{ variant: 'success' | 'info' | 'error'; title: string; lines?: string[] } | null>(null);

  const busy = phase !== 'ready';

  useEffect(() => {
    if (!rewardedAdsSupported()) return;
    let cancelled = false;
    void fetchRewardedAvailability()
      .then((result) => {
        if (!cancelled) setAvailability(result);
      })
      .catch(() => {
        // Không đọc được trần lượt thì cứ ẩn lời đề nghị: thà thiếu một CTA còn hơn hứa sai
        if (!cancelled) setAvailability(null);
      });
    return () => {
      cancelled = true;
    };
  }, [placement]);

  const start = useCallback(async () => {
    setNotice(null);
    setPhase('preparing');
    try {
      setPhase('watching');
      const result = await earnRewardedCredit(placement);

      if (result.kind === 'skipped') {
        setNotice({
          variant: 'info',
          title: 'Chưa xem trọn quảng cáo',
          lines: ['Cần xem hết quảng cáo thì hệ thống mới ghi nhận phần thưởng.'],
        });
        return;
      }
      if (result.kind === 'pending') {
        setNotice({
          variant: 'info',
          title: 'Đang chờ xác nhận',
          lines: ['Máy chủ quảng cáo sẽ báo về trong ít phút, credit sẽ tự vào ví. Mở lại ví để kiểm tra.'],
        });
        return;
      }

      setCreditBalance(result.creditBalance);
      setAvailability((current) =>
        current ? { ...current, remainingToday: result.remainingToday } : current
      );
      setNotice({
        variant: 'success',
        title: `Đã cộng ${result.creditsEarned} credit`,
        lines: ['Cảm ơn bạn đã đồng hành cùng PalmSight.'],
      });
      onGranted?.(result.creditBalance);
    } catch (error) {
      setNotice({
        variant: 'error',
        title:
          errorCodeOf(error) === 'REWARDED_AD_CAP_REACHED'
            ? 'Hết lượt trong 24 giờ'
            : 'Chưa cấp được credit',
        lines: [errorMessageOf(error)],
      });
    } finally {
      setPhase('ready');
    }
  }, [onGranted, placement, setCreditBalance]);

  // Cờ ads tắt, hoặc còn 0 lượt: ẩn hẳn, vì variant inline nằm chen giữa màn hình khác.
  if (!rewardedAdsSupported() || !availability || !availability.enabled) return null;

  const exhausted = availability.remainingToday <= 0;
  const label = exhausted
    ? 'Hết lượt trong 24 giờ'
    : `${PHASE_LABEL[phase]} +${availability.creditsPerAd}`;

  if (variant === 'inline') {
    return (
      <View style={{ gap: spacing.sm }}>
        {exhausted ? null : (
          <Button
            label={label}
            variant="outline"
            disabled={busy || exhausted}
            loading={busy}
            onPress={() => void start()}
            accessibilityLabel={`Xem quảng cáo để nhận ${availability.creditsPerAd} credit`}
            icon={<MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.goldLight} />}
          />
        )}
        {notice ? <Banner variant={notice.variant} title={notice.title} lines={notice.lines} /> : null}
      </View>
    );
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <MaterialCommunityIcons name="play-circle-outline" size={20} color={colors.gold} />
        <Text style={[type.bodyBold, { color: colors.ink, flex: 1 }]}>Xem quảng cáo, nhận credit</Text>
        <Text style={[type.code, { color: colors.stone }]}>
          {`${availability.remainingToday}/${availability.dailyCap}`}
        </Text>
      </View>

      <Text style={[type.caption, { color: colors.mute }]}>
        {exhausted
          ? 'Bạn đã dùng hết lượt quảng cáo thưởng trong 24 giờ. Mời bạn bè nhận mã giới thiệu để có thêm credit.'
          : `Một lượt xem trọn vẹn tặng ${availability.creditsPerAd} credit — bằng đúng một lần bói. Còn ${availability.remainingToday} lượt trong 24 giờ.`}
      </Text>

      <Button
        label={label}
        disabled={busy || exhausted}
        loading={busy}
        onPress={() => void start()}
        accessibilityLabel={`Xem quảng cáo để nhận ${availability.creditsPerAd} credit`}
      />

      {notice ? <Banner variant={notice.variant} title={notice.title} lines={notice.lines} /> : null}

      <Text style={[type.code, { color: colors.stone, fontSize: 10, fontFamily: font.mono }]}>
        Quảng cáo do Google AdMob phân phối · Không ảnh hưởng tới nội dung luận giải
      </Text>
    </Card>
  );
}
