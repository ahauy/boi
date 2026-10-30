import type {
  AuthResponseDto,
  GoogleBrowserStartResponseDto,
  LoginRequestDto,
  RegisterRequestDto,
  RegisterResponseDto,
} from '@palmsight/shared';
import { post } from './api';

// Các endpoint auth tự trả 401/429 cho lý do của nó (sai mật khẩu, chưa xác minh email),
// nên chúng đi với auth:false để vòng refresh của api.ts không can thiệp.
const NO_AUTH = { auth: false } as const;

export function login(body: LoginRequestDto): Promise<AuthResponseDto> {
  return post<AuthResponseDto>('/auth/login', body, NO_AUTH);
}

export function register(body: RegisterRequestDto): Promise<RegisterResponseDto> {
  return post<RegisterResponseDto>('/auth/register', body, { ...NO_AUTH, timeoutMs: 30_000 });
}

export function resendVerification(email: string): Promise<void> {
  return post<void>('/auth/resend-verification', { email }, { ...NO_AUTH, timeoutMs: 30_000 });
}

export function forgotPassword(email: string): Promise<void> {
  return post<void>('/auth/forgot-password', { email }, { ...NO_AUTH, timeoutMs: 30_000 });
}

// Social login native: app nhận idToken (Google) / accessToken (Facebook) từ expo-auth-session
// rồi backend tự xác thực với nhà cung cấp. claimToken dùng để "nhận" bài bói thử của guest.
export function loginWithGoogle(idToken: string, claimToken?: string): Promise<AuthResponseDto> {
  return post<AuthResponseDto>('/auth/google', claimToken ? { idToken, claimToken } : { idToken }, NO_AUTH);
}

export function loginWithFacebook(accessToken: string, claimToken?: string): Promise<AuthResponseDto> {
  return post<AuthResponseDto>('/auth/facebook', claimToken ? { accessToken, claimToken } : { accessToken }, NO_AUTH);
}

// OAuth qua backend cho Expo Go: backend nhận callback https rồi trả mã dùng một lần về app
export function startGoogleBrowserFlow(nativeRedirect: string, claimToken?: string): Promise<GoogleBrowserStartResponseDto> {
  return post<GoogleBrowserStartResponseDto>(
    '/auth/google/browser/start',
    claimToken ? { nativeRedirect, claimToken } : { nativeRedirect },
    { ...NO_AUTH, timeoutMs: 30_000 }
  );
}

export function exchangeGoogleBrowserCode(code: string): Promise<AuthResponseDto> {
  return post<AuthResponseDto>('/auth/google/browser/exchange', { code }, NO_AUTH);
}
