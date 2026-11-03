import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Text from './AppText';
import { Button } from './ui';
import { post } from '../lib/api';
import type { RewardedAdOutcome, RewardedAdPlayRequest } from '../lib/ads';
import { setRewardedAdPlayer } from '../lib/ads';
import { colors, font, radius, spacing, text as type } from '../theme';

/** Ngắn hơn quảng cáo thật: đủ để đi qua nhánh "đã xem trọn" mà không bắt người dev chờ 30 giây. */
const AD_SECONDS = 12;

/**
 * Cờ bật quảng cáo mô phỏng. `__DEV__` nằm ở đây vì ship một nút "xem quảng cáo" giả lên user thật
 * là lỗi nghiêm trọng hơn nhiều so với việc không test được luồng credit.
 */
export function adsMockEnabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_ADS_MOCK === 'true';
}

/**
 * Trình phát quảng cáo thay thế cho Expo Go.
 *
 * SDK ads là native module nên không tồn tại trong Expo Go, trong khi phần còn lại của luồng
 * (xin nonce, trần 24 giờ, cộng credit, ledger, số dư) lại chạy được hết. Linh kiện này phát một
 * màn đếm giờ rồi gọi `POST /ads/rewarded/dev-grant` — endpoint mô phỏng callback của Google — để
 * khoá tín dụng đóng được trên máy ảo mà chưa cần development build.
 */
export default function SimulatedAdHost() {
  const [request, setRequest] = useState<RewardedAdPlayRequest | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(AD_SECONDS);
  const resolveRef = useRef<((outcome: RewardedAdOutcome) => void) | null>(null);
  const grantingRef = useRef(false);

  useEffect(() => {
    if (!adsMockEnabled()) return;

    setRewardedAdPlayer(
      (nextRequest) =>
        new Promise<RewardedAdOutcome>((resolve) => {
          resolveRef.current = resolve;
          grantingRef.current = false;
          setSecondsLeft(AD_SECONDS);
          setRequest(nextRequest);
        })
    );

    return () => setRewardedAdPlayer(null);
  }, []);

  const close = useCallback((outcome: RewardedAdOutcome) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(outcome);
  }, []);

  useEffect(() => {
    if (!request) return;

    if (secondsLeft > 0) {
      const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (grantingRef.current) return;
    grantingRef.current = true;
    void post('/ads/rewarded/dev-grant', { nonce: request.nonce })
      .catch((error: unknown) => {
        // Không đổi thành 'skipped': người dùng đã xem trọn, chỉ là chưa có xác nhận. Để luồng thật
        // tự báo 'pending' là cách đúng để lộ ra cờ dev-grant chưa bật trên backend.
        console.warn('[ads-mock] dev-grant thất bại, claim sẽ ở trạng thái chờ xác nhận:', error);
      })
      .finally(() => close('earned'));
  }, [close, request, secondsLeft]);

  if (!request) return null;

  const finished = secondsLeft <= 0;

  return (
    <Modal visible onRequestClose={() => close('skipped')} animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.canvas, padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.gold,
              backgroundColor: colors.goldWash,
            }}>
            <Text style={[type.code, { color: colors.goldLight, fontFamily: font.monoMedium }]}>
              MÔ PHỎNG
            </Text>
          </View>
          <Text style={[type.caption, { color: colors.mute, flex: 1 }]}>
            Màn quảng cáo giả để test luồng credit. Chưa nối AdMob.
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.md,
          }}>
          <MaterialCommunityIcons
            name={finished ? 'check-circle-outline' : 'play-circle-outline'}
            size={92}
            color={finished ? colors.goldLight : colors.gold}
          />
          <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>
            {finished ? 'Đã xem trọn vẹn' : `Quảng cáo ${secondsLeft}s`}
          </Text>
          <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
            {finished
              ? 'Đang chờ máy chủ xác nhận phần thưởng...'
              : 'Với quảng cáo thật, credit chỉ về khi Google xác nhận bạn đã xem hết.'}
          </Text>
        </View>

        <Button
          label={finished ? 'Đang xác nhận...' : 'Bỏ qua (không nhận credit)'}
          variant="outline"
          disabled={finished}
          onPress={() => close('skipped')}
        />
      </View>
    </Modal>
  );
}
