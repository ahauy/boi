import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { loginSchema } from '@palmsight/shared';

import Screen, { ScreenHeader } from '../../components/Screen';
import { Banner, Button, Input, LinkFooter } from '../../components/ui';
import { exchangeGoogleBrowserCode, resendVerification, startGoogleBrowserFlow } from '../../lib/authApi';
import { ApiError } from '../../lib/api';
import { errorCodeOf, errorMessageOf, validateForm } from '../../lib/forms';
import { colors, spacing, text as type } from '../../theme';
import { useAuth } from '../../state/auth';

// Trên web cần gọi hàm này để popup OAuth đóng lại sau khi chuyển hướng về app
WebBrowser.maybeCompleteAuthSession();

// Expo Go không nhận redirect scheme native (Google chặn exp://) nên đi qua backend:
// backend nhận callback https rồi redirect về app bằng exp:// kèm mã dùng một lần.
// Development build dùng OAuth native như bình thường.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

// expo-auth-session ném lỗi khi thiếu client ID của nền tảng hiện tại, nên chỉ dựng nút khi đã cấu hình
const GOOGLE_CLIENT_ID =
  Platform.OS === 'android'
    ? GOOGLE_ANDROID_CLIENT_ID
    : Platform.OS === 'ios'
      ? GOOGLE_IOS_CLIENT_ID
      : GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ENABLED = Boolean(GOOGLE_CLIENT_ID);
const FACEBOOK_ENABLED = Boolean(FACEBOOK_APP_ID);

// Google bắt redirect native dùng scheme là "reversed client ID" và phải khai báo scheme này trong app.json
const GOOGLE_REDIRECT_URI = GOOGLE_CLIENT_ID
  ? `com.googleusercontent.apps.${GOOGLE_CLIENT_ID.replace(/\.apps\.googleusercontent\.com$/, '')}:/oauthredirect`
  : undefined;

type SocialProvider = 'google' | 'facebook';

interface SocialButtonProps {
  claimToken?: string;
  onError: (message: string) => void;
  onStart: () => void;
  busy: boolean;
  setSocialBusy: React.Dispatch<React.SetStateAction<SocialProvider | null>>;
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { claimToken } = useLocalSearchParams<{ claimToken?: string }>();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);

  const clearMessages = useCallback(() => {
    setFailure(null);
    setResendEmail(null);
    setNotice(null);
  }, []);

  const showSocial = IS_EXPO_GO || GOOGLE_ENABLED || FACEBOOK_ENABLED;
  const showGoogle = IS_EXPO_GO || GOOGLE_ENABLED;

  const showSocialFailure = useCallback((message: string) => {
    setFailure(message);
    setResendEmail(null);
  }, []);

  async function submit() {
    clearMessages();
    const fieldErrors = await validateForm(loginSchema, { login, password });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setBusy(true);
    try {
      await signIn(login.trim().toLowerCase(), password);
      // Không điều hướng: root layout tự chuyển sang tabs khi status = signedIn
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'EMAIL_NOT_VERIFIED') {
        const emailFromServer = error instanceof ApiError && typeof error.details.email === 'string' ? error.details.email : null;
        setResendEmail(emailFromServer ?? (login.includes('@') ? login.trim().toLowerCase() : null));
        setFailure('Email của bạn chưa được xác minh. Hãy mở link trong email, hoặc gửi lại email xác minh.');
      } else {
        setResendEmail(null);
        setFailure(errorMessageOf(error, 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'));
      }
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!resendEmail) return;
    setBusy(true);
    try {
      await resendVerification(resendEmail);
      setFailure(null);
      setResendEmail(null);
      setNotice('Đã gửi lại email xác minh. Kiểm tra hộp thư (cả thư mục Spam).');
    } catch (error) {
      setFailure(errorMessageOf(error, 'Không thể gửi lại email vào lúc này. Vui lòng thử lại sau.'));
    } finally {
      setBusy(false);
    }
  }

  function goToRegister() {
    router.push(claimToken ? { pathname: '/register', params: { claimToken } } : '/register');
  }

  return (
    <Screen
      scrollRef={scrollRef}
      header={
        <ScreenHeader
          eyebrow="Cổng Huyền Môn"
          title="Đăng nhập"
          subtitle="Dùng email hoặc tên đăng nhập của bạn."
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/onboarding'))}
        />
      }
      footer={
        <View style={{ gap: spacing.md }}>
          <Button
            label={busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
            onPress={submit}
            loading={busy}
            disabled={socialBusy !== null}
          />
          <LinkFooter question="Chưa có tài khoản?" action="Tạo tài khoản mới" onPress={goToRegister} />
        </View>
      }>
      <View style={{ gap: spacing.lg }}>
        <Input
          label="Email hoặc tên đăng nhập"
          value={login}
          onChangeText={(value) => {
            setLogin(value);
            setErrors({});
            clearMessages();
          }}
          placeholder="minhanh@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="username"
          error={errors.login}
        />

        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[type.headingSm, { color: colors.ink }]}>Mật khẩu</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/forgot-password')}
              hitSlop={12}
              style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={[type.caption, { color: colors.gold }]}>Quên mật khẩu?</Text>
            </Pressable>
          </View>
          <Input
            accessibilityLabel="Mật khẩu"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setErrors({});
            }}
            placeholder="••••••••"
            secure
            autoComplete="current-password"
            onSubmitEditing={submit}
            returnKeyType="go"
            error={errors.password}
          />
        </View>

        {failure ? (
          <Banner
            variant="error"
            title={failure}
            action={resendEmail ? { label: 'Gửi lại email xác minh', onPress: resend } : undefined}
          />
        ) : null}
        {notice ? <Banner variant="success" title={notice} /> : null}

        {showSocial ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ height: 1, flex: 1, backgroundColor: colors.hairline }} />
              <Text style={[type.caption, { color: colors.stone }]}>hoặc đăng nhập nhanh</Text>
              <View style={{ height: 1, flex: 1, backgroundColor: colors.hairline }} />
            </View>

            {showGoogle ? (
              IS_EXPO_GO ? (
                <GoogleBrowserSignInButton
                  claimToken={claimToken}
                  onError={showSocialFailure}
                  onStart={clearMessages}
                  busy={socialBusy === 'google'}
                  setSocialBusy={setSocialBusy}
                />
              ) : (
                <GoogleSignInButton
                  claimToken={claimToken}
                  onError={showSocialFailure}
                  onStart={clearMessages}
                  busy={socialBusy === 'google'}
                  setSocialBusy={setSocialBusy}
                />
              )
            ) : null}

            {FACEBOOK_ENABLED ? (
              <FacebookSignInButton
                claimToken={claimToken}
                onError={showSocialFailure}
                onStart={clearMessages}
                busy={socialBusy === 'facebook'}
                setSocialBusy={setSocialBusy}
              />
            ) : null}
          </View>
        ) : null}

        <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
          <Text style={[type.caption, { color: colors.mute }]}>Chưa muốn tạo tài khoản?</Text>
          <Button label="✦ Bói thử miễn phí (khách)" variant="ghost" onPress={() => router.push('/guest')} />
        </View>
      </View>
    </Screen>
  );
}

function GoogleBrowserSignInButton({ claimToken, onError, onStart, busy, setSocialBusy }: SocialButtonProps) {
  const { completeSignIn } = useAuth();

  async function start() {
    onStart();
    setSocialBusy('google');
    try {
      const returnUrl = Linking.createURL('google-auth');
      const { authorizeUrl } = await startGoogleBrowserFlow(returnUrl, claimToken);
      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);

      if (result.type !== 'success' || !result.url) {
        setSocialBusy(null);
        return;
      }

      const params = Linking.parse(result.url).queryParams ?? {};
      const code = typeof params.code === 'string' ? params.code : undefined;
      const oauthError = typeof params.error === 'string' ? params.error : undefined;

      if (!code) {
        setSocialBusy(null);
        onError(
          oauthError === 'access_denied'
            ? 'Bạn đã huỷ đăng nhập trên Google.'
            : 'Không hoàn tất được đăng nhập Google. Vui lòng thử lại.'
        );
        return;
      }

      const auth = await exchangeGoogleBrowserCode(code);
      await completeSignIn(auth);
    } catch (cause) {
      setSocialBusy(null);
      if (cause instanceof ApiError && cause.code === 'GOOGLE_BROWSER_NOT_CONFIGURED') {
        onError('Đăng nhập bằng Google tạm thời chưa khả dụng. Vui lòng thử lại sau.');
        return;
      }
      onError(errorMessageOf(cause, 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.'));
    }
  }

  return (
    <Button
      label={busy ? 'Đang mở Google...' : 'Đăng nhập bằng Google'}
      variant="outline"
      onPress={start}
      loading={busy}
    />
  );
}

function GoogleSignInButton({ claimToken, onError, onStart, busy, setSocialBusy }: SocialButtonProps) {
  const { signInWithGoogle } = useAuth();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri: GOOGLE_REDIRECT_URI,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      // Native trả code rồi hook tự đổi thành token: id_token chỉ có ở response cuối cùng
      const idToken = response.params?.id_token || response.authentication?.idToken;
      if (!idToken) {
        setSocialBusy(null);
        onError('Google không trả về mã đăng nhập. Vui lòng thử lại.');
        return;
      }
      signInWithGoogle(idToken, claimToken).catch((cause) => {
        setSocialBusy(null);
        onError(errorMessageOf(cause, 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.'));
      });
      return;
    }

    setSocialBusy(null);
    if (response.type === 'error') onError('Không thể xác thực với Google. Vui lòng thử lại.');
  }, [response, claimToken, signInWithGoogle, onError, setSocialBusy]);

  function start() {
    onStart();
    setSocialBusy('google');
    promptAsync().catch((cause) => {
      setSocialBusy(null);
      onError(errorMessageOf(cause, 'Không mở được cửa sổ đăng nhập Google.'));
    });
  }

  return (
    <Button
      label={busy ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}
      variant="outline"
      onPress={start}
      loading={busy}
      disabled={!request}
    />
  );
}

function FacebookSignInButton({ claimToken, onError, onStart, busy, setSocialBusy }: SocialButtonProps) {
  const { signInWithFacebook } = useAuth();
  const [request, response, promptAsync] = Facebook.useAuthRequest({ clientId: FACEBOOK_APP_ID });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const accessToken = response.authentication?.accessToken || response.params?.access_token;
      if (!accessToken) {
        setSocialBusy(null);
        onError('Facebook không trả về mã đăng nhập. Vui lòng thử lại.');
        return;
      }
      signInWithFacebook(accessToken, claimToken).catch((cause) => {
        setSocialBusy(null);
        onError(errorMessageOf(cause, 'Đăng nhập bằng Facebook thất bại. Vui lòng thử lại.'));
      });
      return;
    }

    setSocialBusy(null);
    if (response.type === 'error') onError('Không thể xác thực với Facebook. Vui lòng thử lại.');
  }, [response, claimToken, signInWithFacebook, onError, setSocialBusy]);

  function start() {
    onStart();
    setSocialBusy('facebook');
    promptAsync().catch((cause) => {
      setSocialBusy(null);
      onError(errorMessageOf(cause, 'Không mở được cửa sổ đăng nhập Facebook.'));
    });
  }

  return (
    <Button
      label={busy ? 'Đang kết nối Facebook...' : 'Đăng nhập bằng Facebook'}
      variant="ghost"
      onPress={start}
      loading={busy}
      disabled={!request}
    />
  );
}
