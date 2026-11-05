import { UserSummaryDto } from "./user.dto";

/** Phiên khách ẩn danh: mobile gửi mã thiết bị đã lưu trong SecureStore để lấy lại đúng tài khoản */
export interface DeviceSessionRequestDto {
  deviceId: string;
}

export interface RefreshTokenResponseDto {
  accessToken: string;
  expiresIn: number;
  /** Refresh token đã xoay vòng; app thay token cũ bằng token này */
  refreshToken?: string;
}

export interface AuthResponseDto {
  accessToken: string;
  expiresIn: number;
  isNewUser: boolean;
  user: UserSummaryDto;
  /** Refresh token của phiên khách; app lưu trong SecureStore */
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
