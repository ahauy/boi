import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import {
  DeviceSessionRequestDto,
  AuthResponseDto,
  deviceSessionSchema,
  RefreshTokenResponseDto,
} from "@palmsight/shared";
import { AuthService } from "./auth.service";
import { AuthRateLimitGuard } from "./guards/auth-rate-limit.guard";

/**
 * Chỉ còn hai route cho app mobile: `device` (mở phiên khách theo thiết bị) và `refresh`.
 * Không có đăng ký/đăng nhập/cookie: refresh token đi qua header `x-refresh-token` và body JSON.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // App mobile không có màn đăng nhập: thiết bị tự đổi mã định danh lấy phiên khách.
  // Không gắn AuthRateLimitGuard: mạng di động dùng CGNAT, nhiều người thật có thể chung IP;
  // chống lạm dụng nằm ở ANONYMOUS_SIGNUP_DAILY_CAP trong service.
  @Post("device")
  @HttpCode(HttpStatus.OK)
  async deviceSession(
    @Body() body: DeviceSessionRequestDto,
    @Req() req: Request
  ): Promise<AuthResponseDto> {
    const validated = await deviceSessionSchema.validate(body, {
      abortEarly: false,
    });
    const rawIp =
      (req.headers["x-forwarded-for"] as string) ||
      req.ip ||
      req.socket?.remoteAddress ||
      "127.0.0.1";
    const clientIp = rawIp.split(",")[0].trim();

    const { authResponse, rawRefreshToken } =
      await this.authService.createDeviceSession(validated, clientIp);

    return { ...authResponse, refreshToken: rawRefreshToken };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async refresh(@Req() req: Request): Promise<RefreshTokenResponseDto> {
    const headerToken = req.headers["x-refresh-token"];
    const { tokens, rawRefreshToken } = await this.authService.refresh(
      typeof headerToken === "string" && headerToken.length > 0
        ? headerToken
        : undefined
    );
    return { ...tokens, refreshToken: rawRefreshToken };
  }
}
