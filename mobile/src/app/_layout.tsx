import React, { useEffect } from 'react';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CormorantGaramond_600SemiBold, CormorantGaramond_600SemiBold_Italic, CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond';
import { BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';

import { AuthProvider, useAuth } from '../state/auth';
import { CaptureProvider } from '../state/capture';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync();

// Khi mở app ở URL "/" (route tabs bị chặn nếu chưa đăng nhập), router lùi về anchor này
// thay vì rơi vào nhóm (auth) — đảm bảo người chưa đăng nhập luôn thấy onboarding trước
export const unstable_settings = { anchor: 'onboarding' };

// Web chỉ có giao diện tối (index.html hard-code class="dark") nên app khoá theo tối:
// tab bar, modal và native stack đều nhận bảng màu này
const palmTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.canvas,
    card: colors.card,
    text: colors.ink,
    border: colors.hairline,
  },
};

function Gate({ appReady }: { appReady: boolean }) {
  const { status } = useAuth();

  useEffect(() => {
    if (appReady && status !== 'loading') void SplashScreen.hideAsync();
  }, [appReady, status]);

  if (!appReady || status === 'loading') return null;

  const signedOut = status === 'signedOut';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      {/* Chưa đăng nhập: onboarding slides luôn hiện (bó thử guest / đăng nhập / đăng ký) */}
      <Stack.Protected guard={signedOut}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="guest" />
        <Stack.Screen name="guest-reading/[token]" />
      </Stack.Protected>

      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reading/[id]" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="referral" />
        <Stack.Screen name="enter-referral" />
      </Stack.Protected>

      {/* Modal camera phục vụ cả luồng thành viên lẫn luồng guest */}
      <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  // Font logo/heading có dấu tiếng Việt: nạp trước khi render để không nháy font hệ thống.
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_600SemiBold_Italic,
    CormorantGaramond_700Bold,
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  return (
    <SafeAreaProvider>
      <CaptureProvider>
        <AuthProvider>
          <ThemeProvider value={palmTheme}>
            <StatusBar style="light" />
            <Gate appReady={fontsLoaded || Boolean(fontError)} />
          </ThemeProvider>
        </AuthProvider>
      </CaptureProvider>
    </SafeAreaProvider>
  );
}
