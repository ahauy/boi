import React, { useEffect } from 'react';
import { DarkTheme, router, Stack, ThemeProvider, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CormorantGaramond_600SemiBold, CormorantGaramond_600SemiBold_Italic, CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond';
import { BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';

import { AuthProvider, useAuth } from '../state/auth';
import { OnboardingProvider, useOnboarding } from '../state/onboarding';
import { CaptureProvider } from '../state/capture';
import { SessionErrorScreen, SessionLoadingScreen } from '../components/SessionGate';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync();

// App mở ở "/" (route tabs). Khi onboarding còn bắt buộc, route này bị chặn và router lùi về anchor.
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
  const { status: onboarding } = useOnboarding();
  const pathname = usePathname();

  useEffect(() => {
    if (!appReady) return;
    if (status === 'error' || (status === 'ready' && onboarding !== 'loading')) {
      void SplashScreen.hideAsync();
    }
  }, [appReady, status, onboarding]);

  // Hoàn tất onboarding: đợi guard mở tabs rồi mới điều hướng, tránh replace vào route còn bị chặn
  useEffect(() => {
    if (status === 'ready' && onboarding === 'done' && pathname === '/onboarding') {
      router.replace('/');
    }
  }, [status, onboarding, pathname]);

  if (!appReady) return null;
  if (status === 'error') return <SessionErrorScreen />;
  if (status === 'loading' || onboarding === 'loading') return <SessionLoadingScreen />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      {/* Lần đầu mở app và chưa có bài bói: đi hết onboarding mới vào được Xem bói */}
      <Stack.Protected guard={onboarding === 'pending'}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack.Protected>

      <Stack.Protected guard={onboarding === 'done'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reading/[id]" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="referral" />
        <Stack.Screen name="enter-referral" />
      </Stack.Protected>

      {/* Modal camera phục vụ luồng Xem bói */}
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
          <OnboardingProvider>
            <ThemeProvider value={palmTheme}>
              <StatusBar style="light" />
              <Gate appReady={fontsLoaded || Boolean(fontError)} />
            </ThemeProvider>
          </OnboardingProvider>
        </AuthProvider>
      </CaptureProvider>
    </SafeAreaProvider>
  );
}
