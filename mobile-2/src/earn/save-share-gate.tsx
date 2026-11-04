/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Text from '../components/AppText';
import { Button } from '../components/ui';
import { isMaxRewardedReady } from '../ads/ads-service';
import { watchForAction } from '../ads/rewarded';
import { triggerPaywall } from '../premium/paywall-triggers';
import { useAuth } from '../state/auth';
import { t } from '../i18n';
import { colors, radius, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

export const WAIT_AD_TIMEOUT_SECONDS = 15;

export interface SaveShareGateProps {
  visible: boolean;
  onClose: () => void;
  onProceed: () => void;
}

export function SaveShareGate({ visible, onClose, onProceed }: SaveShareGateProps) {
  const { user } = useAuth();
  const isVip = Boolean((user as any)?.isVip || user?.vip?.active);

  const [waitingAd, setWaitingAd] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WAIT_AD_TIMEOUT_SECONDS);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // If VIP user opens this gate, immediately proceed (§6.3)
  useEffect(() => {
    if (visible && isVip) {
      onProceed();
      onClose();
    }
  }, [visible, isVip, onProceed, onClose]);

  // Wait sheet countdown and ad polling up to 15s (§6.3)
  useEffect(() => {
    if (!waitingAd) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    setSecondsLeft(WAIT_AD_TIMEOUT_SECONDS);

    // 1-second countdown
    timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timer) clearInterval(timer);
          if (pollTimer) clearInterval(pollTimer);
          setWaitingAd(false);
          // Unavailable after 15s: show adUnavailable and cancel without granting
          setErrorNotice(t('saveShare.adUnavailable'));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Poll isMaxRewardedReady every 1.5s
    pollTimer = setInterval(async () => {
      try {
        const ready = await isMaxRewardedReady();
        if (ready) {
          if (timer) clearInterval(timer);
          if (pollTimer) clearInterval(pollTimer);
          setWaitingAd(false);
          // Show the ad
          await executeAdWatch();
        }
      } catch {
        // Continue waiting
      }
    }, 1500);

    return () => {
      if (timer) clearInterval(timer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [waitingAd]);

  async function executeAdWatch() {
    try {
      const res = await watchForAction('save_share');
      if (res.completed) {
        haptic.success();
        onProceed();
        onClose();
      } else {
        setErrorNotice('Xem hết quảng cáo để thực hiện thao tác.');
      }
    } catch (err: any) {
      setErrorNotice(err?.message ?? t('saveShare.adUnavailable'));
    }
  }

  async function handleWatchAd() {
    setErrorNotice(null);
    haptic.tap();

    const ready = await isMaxRewardedReady();
    if (ready) {
      await executeAdWatch();
    } else {
      // Ad not ready: start 15s wait sheet with polling
      setWaitingAd(true);
    }
  }

  function handleGetVip() {
    haptic.select();
    onClose();
    void triggerPaywall('locked_feature');
  }

  if (!visible || isVip) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(28,38,76,0.98)', 'rgba(8,13,30,0.98)']}
            style={styles.cardContent}>
            {waitingAd ? (
              // Wait sheet polling for ad (up to 15s)
              <View style={styles.waitContent}>
                <ActivityIndicator size="large" color={colors.goldLight} />
                <Text style={[type.headingSm, { color: colors.ink, textAlign: 'center' }]}>
                  {`Đang tải quảng cáo (${secondsLeft}s)…`}
                </Text>
                <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
                  Thao tác sẽ tự động tiếp tục khi quảng cáo sẵn sàng.
                </Text>
                <Button
                  label="Mở VIP để bỏ qua quảng cáo"
                  variant="outline"
                  onPress={handleGetVip}
                  noInterstitial
                  icon={<MaterialCommunityIcons name="crown-outline" size={16} color={colors.goldLight} />}
                />
              </View>
            ) : (
              // Prompt sheet
              <>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="share-variant-outline" size={32} color={colors.goldLight} />
                </View>

                <View style={styles.header}>
                  <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>
                    Xem quảng cáo để tiếp tục
                  </Text>
                  <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
                    Xem 1 video quảng cáo ngắn để Lưu hoặc Chia sẻ kết quả xem bói.
                  </Text>
                </View>

                {errorNotice ? (
                  <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>
                    {errorNotice}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  <Button
                    label="Xem quảng cáo"
                    onPress={() => void handleWatchAd()}
                    noInterstitial
                    icon={
                      <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.onGold} />
                    }
                  />

                  <Button
                    label={`${t('saveShare.getVip')} — ${t('paywall.benefit3')}`}
                    variant="outline"
                    onPress={handleGetVip}
                    noInterstitial
                    icon={<MaterialCommunityIcons name="crown-outline" size={16} color={colors.goldLight} />}
                  />

                  <Button
                    label="Để sau"
                    variant="ghost"
                    onPress={onClose}
                    noInterstitial
                  />
                </View>
              </>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Hook helper for gating save/share action:
 * - If VIP: executes action immediately
 * - If free: returns requestAccess callback to trigger gate modal
 */
export function useSaveShareGate(isVip: boolean = false) {
  const [gateOpen, setGateOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requestAccess = useCallback(
    (action: () => void) => {
      if (isVip) {
        action();
      } else {
        pendingActionRef.current = action;
        setGateOpen(true);
      }
    },
    [isVip]
  );

  const handleProceed = useCallback(() => {
    const act = pendingActionRef.current;
    pendingActionRef.current = null;
    act?.();
  }, []);

  const handleClose = useCallback(() => {
    pendingActionRef.current = null;
    setGateOpen(false);
  }, []);

  return {
    gateOpen,
    requestAccess,
    handleProceed,
    handleClose,
  };
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(4,6,17,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    ...shadow.card,
    width: '100%',
    maxWidth: 380,
    borderRadius: radius['3xl'],
    overflow: 'hidden',
  },
  cardContent: {
    padding: spacing.xl,
    gap: spacing.lg,
    alignItems: 'center',
  },
  waitContent: {
    width: '100%',
    paddingVertical: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.goldWashStrong,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
});

export default SaveShareGate;
