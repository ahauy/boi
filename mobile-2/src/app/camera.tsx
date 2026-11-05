import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { CameraView, useCameraPermissions, type CameraView as CameraViewHandle } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/ui';
import Text from '../components/AppText';
import HandGuide from '../components/mystic/HandGuide';
import CosmicBackground from '../components/CosmicBackground';
import CosmicHand from '../components/CosmicHand';
import { colors, radius, spacing, text as type } from '../theme';
import { t, useI18n } from '../i18n';
import { runExternalActivity } from '../lib/external-activity';
import { haptic } from '../lib/haptics';
import { useAnimatedValue } from '../lib/useAnimatedValue';
import { useReduceMotion } from '../lib/motion';
import { useCapture } from '../state/capture';
import { useReadingDraft } from '../state/readingDraft';

const HINTS = ['scan.hintLight', 'scan.hintFingers', 'scan.hintCamera'] as const;

export default function CameraScreen() {
  useI18n();
  const insets = useSafeAreaInsets();
  const { submitPhoto } = useCapture();
  const { hand } = useReadingDraft();
  const cameraRef = useRef<CameraViewHandle>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [torch, setTorch] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guideAreaHeight, setGuideAreaHeight] = useState(0);
  const flash = useAnimatedValue(0);
  const reduceMotion = useReduceMotion();

  function fireFlash() {
    if (reduceMotion) return;
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.85, duration: 60, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
  }

  async function capture() {
    if (!ready || capturing) return;
    haptic.capture();
    fireFlash();
    setCapturing(true);
    setError(null);
    try {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.9, exif: false });
      if (!shot?.uri) {
        setError(t('camera.captureFailed'));
        return;
      }
      submitPhoto({ uri: shot.uri, name: `palm-${Date.now()}.jpg`, type: 'image/jpeg' });
      // Modal mở từ cả Trang chủ lẫn phòng quét, nên về đích là /scan chứ không phải `back()`:
      // nút "Xem bói" và checkbox đồng ý chỉ tồn tại ở đó.
      setTimeout(() => router.navigate('/scan'), 120);
    } catch {
      // Android throw khi preview chưa sẵn sàng
      setError(t('camera.captureError'));
    } finally {
      setCapturing(false);
    }
  }

  async function pickFromGallery() {
    haptic.select();
    setError(null);
    const libraryPermission = await runExternalActivity('permission', () => ImagePicker.requestMediaLibraryPermissionsAsync());
    if (!libraryPermission.granted) {
      setError(t('camera.libraryDenied'));
      return;
    }
    const result = await runExternalActivity('photo_picker', () =>
      ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false })
    );
    if (result.canceled || result.assets.length === 0) return;
    submitPhoto({ uri: result.assets[0].uri, name: `palm-${Date.now()}.jpg`, type: 'image/jpeg' });
    router.navigate('/scan');
  }

  function toggleSelfie() {
    haptic.select();
    setSelfie((value) => {
      if (!value) setTorch(false);
      return !value;
    });
  }

  function measureGuideArea(event: LayoutChangeEvent) {
    setGuideAreaHeight(event.nativeEvent.layout.height);
  }

  if (!permission) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', gap: spacing.md }]}>
        <CosmicBackground />
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={[type.bodyMd, { color: colors.mute }]}>{t('camera.checking')}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.root}>
        <CosmicBackground />
        <View
          style={{
            flex: 1,
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: spacing.xl,
            justifyContent: 'center',
            alignItems: 'center',
            gap: spacing.lg,
          }}>
          <CosmicHand size={210} scan={false} />
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text style={[type.eyebrow, { color: colors.gold }]}>{t('camera.eyebrow')}</Text>
            <Text style={[type.headingLg, { color: colors.ink, textAlign: 'center' }]}>{t('camera.permTitle')}</Text>
            <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center', maxWidth: 320 }]}>
              {t('camera.permBody')}
            </Text>
          </View>
          {permission.canAskAgain ? (
            <Button label={t('camera.grant')} onPress={() => void runExternalActivity('permission', requestPermission)} style={{ minWidth: 240 }} noInterstitial />
          ) : (
            <Button label={t('camera.openSettings')} onPress={() => void runExternalActivity('browser', () => Linking.openSettings())} style={{ minWidth: 240 }} noInterstitial />
          )}
          {!permission.canAskAgain ? (
            <Text style={[type.caption, { color: colors.mute, textAlign: 'center', maxWidth: 300 }]}>
              {t('camera.permDenied')}
            </Text>
          ) : null}
          <Button label={t('reading.back')} variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const guideHeight = Math.max(150, Math.min(420, guideAreaHeight - 56));

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={selfie ? 'front' : 'back'} enableTorch={!selfie && torch} onCameraReady={() => setReady(true)} />

      <LinearGradient pointerEvents="none" colors={['rgba(2,3,10,0.9)', 'rgba(2,3,10,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 190 }} />
      <LinearGradient pointerEvents="none" colors={['rgba(2,3,10,0)', 'rgba(2,3,10,0.96)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 330 }} />

      <View style={{ flex: 1, paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('camera.close')} onPress={() => router.back()} style={({ pressed }) => [styles.sideButton, pressed && { opacity: 0.72 }]}>
            <MaterialCommunityIcons name="close" size={23} color={colors.ink} />
          </Pressable>

          <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
            <Text style={[type.eyebrow, { color: colors.gold, letterSpacing: 2.3 }]}>{t('camera.title')}</Text>
            <Text style={[type.displaySm, { color: colors.ink }]} numberOfLines={2}>
              {t('camera.align')}
            </Text>
          </View>

          {selfie ? (
            <View style={{ width: 48, height: 48 }} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={torch ? t('camera.torchOff') : t('camera.torchOn')}
              accessibilityState={{ selected: torch }}
              onPress={() => {
                haptic.select();
                setTorch((value) => !value);
              }}
              style={({ pressed }) => [styles.sideButton, torch && styles.sideButtonActive, pressed && { opacity: 0.72 }]}>
              <MaterialCommunityIcons name={torch ? 'flashlight' : 'flashlight-off'} size={21} color={torch ? colors.goldLight : colors.ink} />
            </Pressable>
          )}
        </View>

        <View style={styles.guideArea} onLayout={measureGuideArea}>
          <Text pointerEvents="none" style={[type.eyebrow, { color: colors.goldLight, textAlign: 'center', marginBottom: spacing.sm, fontSize: 10 }]}>
            {t('camera.frameLabel')}
          </Text>
          {guideAreaHeight > 0 ? <HandGuide height={guideHeight} hand={hand} /> : null}
        </View>

        <View style={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          <View style={styles.hints}>
            {HINTS.map((hint) => (
              <View key={hint} style={styles.hintPill}>
                <Text style={[type.monoStrong, { color: colors.goldLight, fontSize: 10 }]}>{t(hint).toUpperCase()}</Text>
              </View>
            ))}
          </View>

          <Text pointerEvents="none" style={[type.caption, { color: colors.body, textAlign: 'center' }]}>
            {t('camera.holdStill')}
          </Text>

          {error ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[type.caption, styles.error]}>
              {error}
            </Text>
          ) : null}

          <View style={styles.controls}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('camera.pickGallery')} onPress={() => void pickFromGallery()} style={({ pressed }) => [styles.sideButton, pressed && { opacity: 0.72 }]}>
              <MaterialCommunityIcons name="image-multiple-outline" size={21} color={colors.goldLight} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('camera.capture')}
              accessibilityState={{ disabled: !ready || capturing, busy: capturing }}
              onPress={() => void capture()}
              disabled={!ready || capturing}
              style={({ pressed }) => [{ opacity: ready && !capturing ? 1 : 0.55 }, pressed && { transform: [{ scale: 0.94 }] }]}>
              <LinearGradient colors={['#fff4d0', '#e7c777', '#9f8440']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shutterRing}>
                <View style={styles.shutterInner}>{capturing ? <ActivityIndicator size="small" color={colors.gold} /> : <View style={styles.shutterDot} />}</View>
              </LinearGradient>
            </Pressable>

            <Pressable accessibilityRole="button" accessibilityLabel={t('camera.flip')} onPress={toggleSelfie} style={({ pressed }) => [styles.sideButton, pressed && { opacity: 0.72 }]}>
              <MaterialCommunityIcons name="camera-flip-outline" size={23} color={colors.ink} />
            </Pressable>
          </View>
        </View>
      </View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: flash }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.obsidian },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,6,17,0.58)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  sideButtonActive: {
    borderColor: colors.gold,
    backgroundColor: colors.goldWashStrong,
  },
  guideArea: { flex: 1, justifyContent: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  hints: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hintPill: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.full,
    backgroundColor: 'rgba(4,6,17,0.58)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  error: {
    textAlign: 'center',
    color: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(2,3,10,0.86)',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  shutterRing: { width: 78, height: 78, borderRadius: 999, padding: 3, alignItems: 'center', justifyContent: 'center' },
  shutterInner: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDot: { width: 14, height: 14, borderRadius: 999, backgroundColor: colors.gold },
});
