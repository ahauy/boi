import { UserSummaryDto } from "./user.dto";

export interface RegisterRequestDto {
  displayName: string;
  username: string;
  email: string;
  password: string;
  referralCode?: string;
  claimToken?: string;
}

export interface RegisterResponseDto {
  email: string;
  verificationExpiresAt: string;
}

export interface VerifyEmailRequestDto {
  token: string;
  claimToken?: string;
}

export interface ResendVerificationRequestDto {
  email: string;
}

export interface LoginRequestDto {
  login: string;
  password: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}

// Send exactly one: `code` from the OAuth code client, or `idToken` from the GIS button
export interface GoogleAuthRequestDto {
  idToken?: string;
  code?: string;
  claimToken?: string;
}

export interface FacebookAuthRequestDto {
  accessToken: string;
  claimToken?: string;
}

// OAuth qua backend: app mở trang Google, backend nhận callback https (ngrok) rồi trả một mã
// dùng một lần về app — Expo Go không nhận redirect scheme native nên phải đi vòng qua backend
export interface GoogleBrowserStartRequestDto {
  nativeRedirect: string;
  claimToken?: string;
}

export interface GoogleBrowserStartResponseDto {
  authorizeUrl: string;
}

export interface GoogleBrowserExchangeRequestDto {
  code: string;
}

export interface RefreshTokenResponseDto {
  accessToken: string;
  expiresIn: number;
  /** Chỉ có khi refresh bằng header `x-refresh-token` (native app); web nhận qua cookie HttpOnly */
  refreshToken?: string;
}

export interface AuthResponseDto {
  accessToken: string;
  expiresIn: number;
  isNewUser: boolean;
  user: UserSummaryDto;
  claimedReadingId?: string | null;
  claimFailed?: boolean;
  /** Chỉ có khi client gửi header `X-Client: native` (app mobile); web nhận qua cookie HttpOnly */
  refreshToken?: string;
}

export interface ErrorDetailField {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      fields?: ErrorDetailField[];
      requestId?: string;
      [key: string]: unknown;
    };
  };
}
