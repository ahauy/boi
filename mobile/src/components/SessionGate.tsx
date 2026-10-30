import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from './AppText';
import { Button } from './ui';
import MysticBackground from './mystic/MysticBackground';
import { useAuth } from '../state/auth';
import { colors, font, spacing, text as type } from '../theme';

export function SessionLoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
      <ActivityIndicator color={colors.gold} />
      <Text style={[type.caption, { color: colors.stone }]}>Đang kết nối thiên cơ...</Text>
    </View>
  );
}

export function SessionErrorScreen() {
  const { error, retry } = useAuth();
  const insets = useSafeAreaInsets();
  const [retrying, setRetrying] = useState(false);

  async function tryAgain() {
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <MysticBackground />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}>
        <Text style={[type.eyebrow, { color: colors.gold, letterSpacing: 2.6 }]}>✦ KẾT NỐI THIÊN CƠ ✦</Text>
        <Text style={{ fontFamily: font.display, fontSize: 38, lineHeight: 44, color: colors.ink, textAlign: 'center' }}>
          Chưa kết nối được
        </Text>
        <Text style={[type.bodyMd, { color: colors.mute, textAlign: 'center', maxWidth: 320 }]} accessibilityLiveRegion="polite">
          {error ?? 'Không thể kết nối đến PalmSight. Vui lòng thử lại.'}
        </Text>
        <Button label="Thử lại" onPress={tryAgain} loading={retrying} style={{ minWidth: 200 }} />
        <Text style={[type.caption, { color: colors.stone, textAlign: 'center' }]}>
          Kiểm tra Wi-Fi hoặc 4G rồi thử lại. Bài bói cần kết nối để luận giải.
        </Text>
      </View>
    </View>
  );
}
