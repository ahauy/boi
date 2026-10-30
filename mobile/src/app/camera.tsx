import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { CameraView, useCameraPermissions, type CameraView as CameraViewHandle } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner, Button } from '../components/ui';
import Text from '../components/AppText';
import HandGuide from '../components/mystic/HandGuide';
import MysticBackground from '../components/mystic/MysticBackground';
import PalmOracle from '../components/mystic/PalmOracle';
import { colors, radius, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';
import { useAnimatedValue } from '../lib/useAnimatedValue';
import { useCapture } from '../state/capture';

const HINTS = ['ĐỦ SÁNG', 'XÒE NGÓN', 'HƯỚNG CAMERA'] as const;

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const { submitPhoto } = useCapture();
  const cameraRef = useRef<CameraViewHandle>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [torch, setTorch] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guideAreaHeight, setGuideAreaHeight] = useState(0);
  const flash = useAnimatedValue(0);

  function fireFlash() {
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
        setError('Không chụp được ảnh. Hãy thử lại.');
        return;
      }
      submitPhoto({ uri: shot.uri, name: `palm-${Date.now()}.jpg`, type: 'image/jpeg' });
      setTimeout(() => router.back(), 120);
    } catch {
      // Android throw khi preview chưa sẵn sàng
      setError('Không thể chụp ảnh, vui lòng thử lại.');
    } finally {
      setCapturing(false);
    }
  }

  async function pickFromGallery() {
    haptic.select();
    setError(null);
    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libraryPermission.granted) {
      setError('Không thể truy cập thư viện ảnh. Vui lòng cấp quyền trong Cài đặt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false });
    if (result.canceled || result.assets.length === 0) return;
    submitPhoto({ uri: result.assets[0].uri, name: `palm-${Date.now()}.jpg`, type: 'image/jpeg' });
    router.back();
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
        <MysticBackground />
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={[type.bodyMd, { color: colors.mute }]}>Đang kiểm tra quyền camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: spacing.xl,
            justifyContent: 'center',
            gap: spacing.lg,
          },
        ]}>
        <MysticBackground />
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <PalmOracle size={210} />
          <Text style={[type.eyebrow, { color: colors.gold }]}>ẤN TƯỢNG THẤU THỊ</Text>
          <Text style={[type.headingLg, { color: colors.ink, textAlign: 'center' }]}>PalmSight cần quyền camera</Text>
          <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center' }]}>
            Ảnh lòng bàn tay chỉ dùng cho lần xem bói này và không lưu gốc trên máy chủ.
          </Text>
        </View>
        {permission.canAskAgain ? (
          <Button label="Cấp quyền camera" onPress={() => void requestPermission()} />
        ) : (
          <Banner variant="error" title="Đã từ chối quyền camera quá nhiều lần. Bật lại trong Cài đặt ứng dụng." />
        )}
        <Button label="Quay lại" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const guideHeight = Math.max(150, Math.min(420, guideAreaHeight - 60));

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={selfie ? 'front' : 'back'}
        enableTorch={!selfie && torch}
        onCameraReady={() => setReady(true)}
      />

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(7,4,14,0.88)', 'rgba(7,4,14,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 180 }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(7,4,14,0)', 'rgba(7,4,14,0.94)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 320 }}
      />

      <View style={{ flex: 1, paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng camera"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.sideButton, pressed && { opacity: 0.75 }]}>
            <MaterialCommunityIcons name="close" size={24} color={colors.ink} />
          </Pressable>

          <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
            <Text style={[type.eyebrow, { color: colors.gold, letterSpacing: 2.4 }]}>ẤN TƯỢNG THẤU THỊ</Text>
            <Text style={[type.displaySm, { color: colors.ink }]} numberOfLines={2}>
              Căn khung bàn tay
            </Text>
          </View>

          {selfie ? (
            <View style={styles.sideButtonPlaceholder} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={torch ? 'Tắt đèn pin' : 'Bật đèn pin'}
              accessibilityState={{ selected: torch }}
              onPress={() => {
                haptic.select();
                setTorch((value) => !value);
              }}
              style={({ pressed }) => [styles.sideButton, torch && styles.sideButtonActive, pressed && { opacity: 0.75 }]}>
              <MaterialCommunityIcons name={torch ? 'flashlight' : 'flashlight-off'} size={22} color={torch ? colors.gold : colors.ink} />
            </Pressable>
          )}
        </View>

        <View style={styles.guideArea} onLayout={measureGuideArea}>
          <Text pointerEvents="none" style={[type.eyebrow, { color: colors.gold, textAlign: 'center', marginBottom: spacing.sm }]}>
            ✦ KHUNG BÀN TAY ✦
          </Text>
          {guideAreaHeight > 0 ? <HandGuide height={guideHeight} /> : null}
        </View>

        <View style={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          <View style={styles.hints}>
            {HINTS.map((hint) => (
              <View key={hint} style={styles.hintPill}>
                <Text style={[type.monoStrong, { color: colors.goldLight }]}>{hint}</Text>
              </View>
            ))}
          </View>

          <Text pointerEvents="none" style={[type.caption, { color: colors.body, textAlign: 'center' }]}>
            Đưa bàn tay vào khung, giữ yên và chụp.
          </Text>

          {error ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[type.caption, styles.error]}>
              {error}
            </Text>
          ) : null}

          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn ảnh từ thư viện"
              onPress={() => void pickFromGallery()}
              style={({ pressed }) => [styles.sideButton, pressed && { opacity: 0.75 }]}>
              <MaterialCommunityIcons name="image-multiple-outline" size={22} color={colors.goldLight} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chụp ảnh"
              accessibilityState={{ disabled: !ready || capturing, busy: capturing }}
              onPress={() => void capture()}
              disabled={!ready || capturing}
              style={({ pressed }) => [styles.shutter, { opacity: ready && !capturing ? 1 : 0.55 }, pressed && { transform: [{ scale: 0.94 }] }]}>
              <LinearGradient colors={['#f7e7b4', '#d4af37', '#9a7b2c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shutterRing}>
                <View style={styles.shutterInner}>{capturing ? <ActivityIndicator size="small" color={colors.gold} /> : <View style={styles.shutterDot} />}</View>
              </LinearGradient>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đổi camera trước sau"
              onPress={toggleSelfie}
              style={({ pressed }) => [styles.sideButton, pressed && { opacity: 0.75 }]}>
              <MaterialCommunityIcons name="camera-flip-outline" size={24} color={colors.ink} />
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
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,7,22,0.55)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sideButtonActive: {
    borderColor: colors.gold,
    backgroundColor: colors.goldWashStrong,
  },
  sideButtonPlaceholder: { width: 48, height: 48 },
  guideArea: { flex: 1, justifyContent: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  hints: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hintPill: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    backgroundColor: 'rgba(11,7,22,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  error: {
    textAlign: 'center',
    color: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(7,4,14,0.82)',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
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
