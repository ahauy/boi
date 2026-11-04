import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Text from './AppText';
import { Button } from './ui';
import { post } from '../lib/api';
import type { RewardedAdOutcome, RewardedAdPlayRequest } from '../lib/ads';
import { setRewardedAdPlayer } from '../lib/ads';
import {
  setSimulatedInterstitialPlayer,
  setSimulatedRewardedPlayer,
} from '../ads/ads-service';
import { colors, font, radius, spacing, text as type } from '../theme';

/**
 * 16 giây cho quảng cáo thưởng để vượt qua ngưỡng `minWatchSeconds = 15` trên server (§2.2, §5.5).
 * 5 giây cho quảng cáo xen kẽ (interstitial).
 */
const REWARDED_AD_SECONDS = 16;
const INTERSTITIAL_AD_SECONDS = 5;

export function adsMockEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && Boolean(__DEV__) && process.env.EXPO_PUBLIC_ADS_MOCK !== 'false';
}

type ActiveMockAd =
  | {
      mode: 'legacy_rewarded';
      request: RewardedAdPlayRequest;
      resolve: (outcome: RewardedAdOutcome) => void;
    }
  | {
      mode: 'max_rewarded';
      placement?: string;
      resolve: (res: { rewarded: boolean; completed: boolean }) => void;
    }
  | {
      mode: 'max_interstitial';
      placement?: string;
      resolve: () => void;
    };

export default function SimulatedAdHost() {
  const [activeAd, setActiveAd] = useState<ActiveMockAd | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REWARDED_AD_SECONDS);
  const grantingRef = useRef(false);

  useEffect(() => {
    if (!adsMockEnabled()) return;

    // 1. Legacy player
    setRewardedAdPlayer(
      (nextRequest) =>
        new Promise<RewardedAdOutcome>((resolve) => {
          grantingRef.current = false;
          setSecondsLeft(REWARDED_AD_SECONDS);
          setActiveAd({
            mode: 'legacy_rewarded',
            request: nextRequest,
            resolve,
          });
        })
    );

    // 2. AppLovin MAX Rewarded player for Expo Go / Web
    setSimulatedRewardedPlayer(
      (placement) =>
        new Promise<{ rewarded: boolean; completed: boolean }>((resolve) => {
          grantingRef.current = false;
          setSecondsLeft(REWARDED_AD_SECONDS);
          setActiveAd({
            mode: 'max_rewarded',
            placement,
            resolve,
          });
        })
    );

    // 3. AppLovin MAX Interstitial player for Expo Go / Web
    setSimulatedInterstitialPlayer(
      (placement) =>
        new Promise<void>((resolve) => {
          grantingRef.current = false;
          setSecondsLeft(INTERSTITIAL_AD_SECONDS);
          setActiveAd({
            mode: 'max_interstitial',
            placement,
            resolve,
          });
        })
    );

    return () => {
      setRewardedAdPlayer(null);
      setSimulatedRewardedPlayer(null);
      setSimulatedInterstitialPlayer(null);
    };
  }, []);

  const closeAd = useCallback(
    (completed: boolean) => {
      if (!activeAd) return;
      const current = activeAd;
      setActiveAd(null);
      if (current.mode === 'legacy_rewarded') {
        current.resolve(completed ? 'earned' : 'skipped');
      } else if (current.mode === 'max_rewarded') {
        current.resolve({ rewarded: completed, completed });
      } else {
        current.resolve();
      }
    },
    [activeAd]
  );

  useEffect(() => {
    if (!activeAd) return;

    if (secondsLeft > 0) {
      const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (grantingRef.current) return;
    grantingRef.current = true;

    if (activeAd.mode === 'legacy_rewarded') {
      void post('/ads/rewarded/dev-grant', { nonce: activeAd.request.nonce })
        .catch(() => undefined)
        .finally(() => closeAd(true));
      return;
    }

    if (activeAd.mode === 'max_rewarded') {
      const timer = setTimeout(() => closeAd(true), 600);
      return () => clearTimeout(timer);
    }
  }, [activeAd, closeAd, secondsLeft]);

  if (!activeAd) return null;

  const isInterstitial = activeAd.mode === 'max_interstitial';
  const finished = secondsLeft <= 0;
  const placementLabel =
    activeAd.mode !== 'legacy_rewarded' && activeAd.placement
      ? activeAd.placement
      : 'rewarded_video';

  return (
    <Modal
      visible
      onRequestClose={() => closeAd(isInterstitial ? true : finished)}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: colors.canvas, padding: spacing.xl, gap: spacing.lg, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl }}>
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.gold,
              backgroundColor: colors.goldWash,
            }}
          >
            <Text style={[type.code, { color: colors.goldLight, fontFamily: font.monoMedium }]}>
              {isInterstitial ? 'INTERSTITIAL AD (MÔ PHỎNG)' : 'REWARDED AD (MÔ PHỎNG)'}
            </Text>
          </View>
          <Text style={[type.caption, { color: colors.mute, flex: 1 }]} numberOfLines={1}>
            {`Vị trí: ${placementLabel}`}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.md,
          }}
        >
          <MaterialCommunityIcons
            name={finished ? 'check-circle-outline' : 'play-circle-outline'}
            size={92}
            color={finished ? colors.goldLight : colors.gold}
          />
          <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>
            {finished
              ? isInterstitial
                ? 'Có thể đóng quảng cáo'
                : 'Đã xem trọn vẹn! Đang cộng thưởng...'
              : `Đang phát quảng cáo (${secondsLeft}s)`}
          </Text>
          <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
            {isInterstitial
              ? 'Quảng cáo xen kẽ mô phỏng trên Expo Go / Web.'
              : finished
                ? 'Đang gửi xác nhận vé thưởng lên máy chủ...'
                : 'Xem hết 15 giây để máy chủ xác nhận vé thưởng (minWatchSeconds = 15s).'}
          </Text>
        </View>

        <Button
          label={
            isInterstitial
              ? finished
                ? 'Đóng quảng cáo (X)'
                : `Chờ ${secondsLeft}s...`
              : finished
                ? 'Hoàn tất nhận thưởng'
                : 'Đóng sớm (Huỷ vé thưởng)'
          }
          variant={finished ? 'primary' : 'outline'}
          disabled={isInterstitial && !finished}
          noInterstitial
          onPress={() => closeAd(isInterstitial ? true : finished)}
        />
      </View>
    </Modal>
  );
}
