import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ECONOMY_DEFAULTS } from '@palmsight/shared';

import Text from '../components/AppText';
import { Button } from '../components/ui';
import { isRewardedReady, rewardedAvailable } from '../ads/ads-service';
import { watchForAction } from '../ads/rewarded';
import { registerOpenSheet, triggerPaywall } from '../premium/paywall-triggers';
import { useBillingStore } from '../billing';
import { useAuth } from '../state/auth';
import { useI18n } from '../i18n';
import { colors, radius, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

export const NO_AD_WAIT_SECONDS = ECONOMY_DEFAULTS.NO_AD_WAIT_SECONDS;

export interface SaveShareGateProps {
  visible: boolean;
  onClose: () => void;
  onProceed: () => void;
}

export function SaveShareGate({ visible, onClose, onProceed }: SaveShareGateProps) {
  const { user } = useAuth();
  const { billingEnabled } = useBillingStore();
  const { t } = useI18n();
  const isVip = Boolean(user?.vip?.active);

  const [waitingAd, setWaitingAd] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(NO_AD_WAIT_SECONDS);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Cleared as soon as the sheet resolves, so a late-loading ad cannot play over the action.
  const attemptActiveRef = useRef(false);

  const proceed = useCallback(() => {
    attemptActiveRef.current = false;
    setWaitingAd(false);
    setAdBusy(false);
    onProceed();
    onClose();
  }, [onClose, onProceed]);

  const skipGate = visible && (isVip || !rewardedAvailable());

  // VIP saves without ads (§6.6); with no rewarded unit the action runs directly (§1.2).
  useEffect(() => {
    if (!skipGate) return;
    onProceed();
    onClose();
  }, [skipGate, onProceed, onClose]);

  useEffect(() => {
    if (visible && !skipGate) return registerOpenSheet();
  }, [visible, skipGate]);

  useEffect(() => {
    if (!visible) attemptActiveRef.current = false;
  }, [visible]);

  useEffect(
    () => () => {
      attemptActiveRef.current = false;
    },
    []
  );

  // At 0 the action runs anyway (§5.5).
  useEffect(() => {
    if (!waitingAd) return;
    const timer = setTimeout(() => {
      if (secondsLeft <= 1) proceed();
      else setSecondsLeft(secondsLeft - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [waitingAd, secondsLeft, proceed]);

  async function handleWatchAd() {
    if (adBusy) return;
    setErrorNotice(null);
    setAdBusy(true);
    haptic.tap();
    attemptActiveRef.current = true;

    let waiting = false;
    const startWaiting = () => {
      waiting = true;
      setSecondsLeft(NO_AD_WAIT_SECONDS);
      setWaitingAd(true);
    };

    if (!(await isRewardedReady())) startWaiting();

    const status = await watchForAction('save_share', () => {
      if (!attemptActiveRef.current) return false;
      // The ad is opening: the countdown must not run the action underneath it.
      waiting = false;
      setWaitingAd(false);
      return true;
    });
    if (!attemptActiveRef.current) return;

    if (status === 'completed') {
      haptic.success();
      proceed();
    } else if (status === 'no_ad') {
      if (!waiting) startWaiting();
    } else {
      attemptActiveRef.current = false;
      setWaitingAd(false);
      setAdBusy(false);
      setErrorNotice(t('earn.reward.watchFull'));
    }
  }

  function handleClose() {
    attemptActiveRef.current = false;
    setWaitingAd(false);
    setAdBusy(false);
    onClose();
  }

  function handleGetVip() {
    haptic.select();
    handleClose();
    void triggerPaywall('no_ad_wait_sheet');
  }

  if (!visible || skipGate) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(28,38,76,0.98)', 'rgba(8,13,30,0.98)']}
            style={styles.cardContent}>
            {waitingAd ? (
              <View style={styles.waitContent}>
                <ActivityIndicator size="large" color={colors.goldLight} />
                <Text style={[type.headingSm, { color: colors.ink, textAlign: 'center' }]}>
                  {t('earn.actionGate.waitTitle', { seconds: secondsLeft })}
                </Text>
                {billingEnabled ? (
                  <Button
                    label={t('earn.notEnough.getVip')}
                    variant="outline"
                    onPress={handleGetVip}
                    noInterstitial
                    icon={<MaterialCommunityIcons name="crown-outline" size={16} color={colors.goldLight} />}
                  />
                ) : null}
              </View>
            ) : (
              <>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="share-variant-outline" size={32} color={colors.goldLight} />
                </View>

                <Text style={[type.headingMd, { color: colors.ink, textAlign: 'center' }]}>
                  {t('earn.actionGate.title')}
                </Text>

                {errorNotice ? (
                  <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>
                    {errorNotice}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  <Button
                    label={t('earn.actionGate.watchBtn')}
                    onPress={() => void handleWatchAd()}
                    loading={adBusy}
                    disabled={adBusy}
                    noInterstitial
                    icon={
                      <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.onGold} />
                    }
                  />

                  <Button
                    label={t('common.cancel')}
                    variant="ghost"
                    onPress={handleClose}
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
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
});

export default SaveShareGate;
