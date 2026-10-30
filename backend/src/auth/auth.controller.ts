import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response, Request, CookieOptions } from "express";
import { ConfigService } from "@nestjs/config";
import {
  RegisterRequestDto,
  RegisterResponseDto,
  VerifyEmailRequestDto,
  ResendVerificationRequestDto,
  LoginRequestDto,
  DeviceSessionRequestDto,
  AuthResponseDto,
  registerSchema,
  loginSchema,
  deviceSessionSchema,
  GoogleAuthRequestDto,
  googleAuthSchema,
  GoogleBrowserStartRequestDto,
  GoogleBrowserStartResponseDto,
  googleBrowserStartSchema,
  GoogleBrowserExchangeRequestDto,
  googleBrowserExchangeSchema,
  FacebookAuthRequestDto,
  facebookAuthSchema,
  RefreshTokenResponseDto,
  ForgotPasswordRequestDto,
  ResetPasswordRequestDto,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@palmsight/shared";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { AuthRateLimitGuard } from "./guards/auth-rate-limit.guard";
import { OriginGuard } from "./guards/origin.guard";
import { GoogleAuthVerifier } from "./google-auth.verifier";
import { GoogleBrowserAuthService } from "./google-browser-auth.service";
import { FacebookAuthVerifier } from "./facebook-auth.verifier";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
    private readonly googleAuthVerifier: GoogleAuthVerifier,
    private readonly googleBrowserAuth: GoogleBrowserAuthService,
    private readonly facebookAuthVerifier: FacebookAuthVerifier
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthRateLimitGuard)
  async register(
    @Body() body: RegisterRequestDto
  ): Promise<RegisterResponseDto> {
    const validated = await registerSchema.validate(body, {
      abortEarly: false,
    });
    return this.authService.register(validated);
  }

  @Post("resend-verification")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthRateLimitGuard)
  async resendVerification(
    @Body() body: ResendVerificationRequestDto,
    @Req() req: Request & { skipEmailDispatch?: boolean }
  ): Promise<void> {
    if (!body?.email || typeof body.email !== "string") {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi lên không hợp lệ.",
        details: {
          fields: [{ field: "email", message: "Email không được để trống" }],
        },
      });
    }

    if (!req.skipEmailDispatch) {
      await this.authService.resendVerification(body);
    }
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() body: VerifyEmailRequestDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<AuthResponseDto> {
    if (
      !body?.token ||
      typeof body.token !== "string" ||
      body.token.trim().length === 0
    ) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi lên không hợp lệ.",
        details: {
          fields: [
            { field: "token", message: "Mã xác thực không được để trống" },
          ],
        },
      });
    }

    const claimToken = body.claimToken
      ? String(body.claimToken).trim()
      : undefined;
    const { authResponse, rawRefreshToken } =
      await this.authService.verifyEmail(body.token.trim(), claimToken);

    this.setRefreshCookie(res, rawRefreshToken);
    return authResponse;
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<AuthResponseDto> {
    const validated = await loginSchema.validate(body, { abortEarly: false });
    const rawIp =
      (req.headers["x-forwarded-for"] as string) ||
      req.ip ||
      req.socket?.remoteAddress ||
      "127.0.0.1";
    const clientIp = rawIp.split(",")[0].trim();
    const currentRefreshToken = req.cookies?.rt;

    const { authResponse, rawRefreshToken } = await this.authService.login(
      validated,
      currentRefreshToken,
      clientIp
    );

    this.setRefreshCookie(res, rawRefreshToken);
    return this.withNativeRefreshToken(authResponse, rawRefreshToken, req);
  }

  // App mobile không có màn đăng nhập: thiết bị tự đổi mã định danh lấy phiên khách.
  // Không gắn AuthRateLimitGuard: mạng di động dùng CGNAT, nhiều người thật có thể chung IP;
  // chống lạm dụng nằm ở ANONYMOUS_SIGNUP_DAILY_CAP trong service.
  @Post("device")
  @HttpCode(HttpStatus.OK)
  async deviceSession(
    @Body() body: DeviceSessionRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
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

    this.setRefreshCookie(res, rawRefreshToken);
    return this.withNativeRefreshToken(authResponse, rawRefreshToken, req);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthRateLimitGuard)
  async forgotPassword(
    @Body() body: ForgotPasswordRequestDto,
    @Req() req: Request & { skipEmailDispatch?: boolean }
  ): Promise<void> {
    const validated = await forgotPasswordSchema.validate(body, {
      abortEarly: false,
    });
    if (!req.skipEmailDispatch) {
      await this.passwordService.forgotPassword(validated);
    }
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthRateLimitGuard)
  async resetPassword(@Body() body: ResetPasswordRequestDto): Promise<void> {
    const validated = await resetPasswordSchema.validate(body, {
      abortEarly: false,
    });
    await this.passwordService.resetPassword(validated);
  }

  @Post("google")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async google(
    @Body() body: GoogleAuthRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<AuthResponseDto> {
    const validated = await googleAuthSchema.validate(body, {
      abortEarly: false,
    });
    const profile = validated.code
      ? await this.googleAuthVerifier.verifyCode(validated.code)
      : await this.googleAuthVerifier.verify(validated.idToken as string);

    const claimToken = validated.claimToken
      ? String(validated.claimToken).trim()
      : undefined;
    const { authResponse, rawRefreshToken } =
      await this.authService.googleLogin(profile, req.cookies?.rt, claimToken);

    this.setRefreshCookie(res, rawRefreshToken);
    return this.withNativeRefreshToken(authResponse, rawRefreshToken, req);
  }

  // OAuth trung gian cho Expo Go: app xin URL Google, backend nhận callback https (ngrok khi dev)
  // rồi chuyển tiếp về app bằng deep link exp:// kèm mã dùng một lần
  @Post("google/browser/start")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async googleBrowserStart(
    @Body() body: GoogleBrowserStartRequestDto
  ): Promise<GoogleBrowserStartResponseDto> {
    const validated = await googleBrowserStartSchema.validate(body, {
      abortEarly: false,
    });
    return {
      authorizeUrl: this.googleBrowserAuth.createAuthorizationUrl(
        validated.nativeRedirect,
        validated.claimToken
      ),
    };
  }

  @Get("google/browser/callback")
  async googleBrowserCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const pending = state ? this.googleBrowserAuth.consumeState(state) : null;
    if (!pending) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send("Phiên đăng nhập đã hết hạn. Vui lòng quay lại app và thử lại.");
      return;
    }

    if (error || !code) {
      res.redirect(
        this.withQuery(
          pending.nativeRedirect,
          `error=${encodeURIComponent(error ?? "google_failed")}`
        )
      );
      return;
    }

    try {
      const idToken = await this.googleBrowserAuth.exchangeCode(code);
      const profile = await this.googleAuthVerifier.verify(idToken);
      const { authResponse, rawRefreshToken } =
        await this.authService.googleLogin(
          profile,
          undefined,
          pending.claimToken
        );
      const exchangeCode = this.googleBrowserAuth.createExchangeCode({
        ...authResponse,
        refreshToken: rawRefreshToken,
      });
      res.redirect(this.withQuery(pending.nativeRedirect, `code=${exchangeCode}`));
    } catch {
      res.redirect(this.withQuery(pending.nativeRedirect, "error=google_failed"));
    }
  }

  @Post("google/browser/exchange")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async googleBrowserExchange(
    @Body() body: GoogleBrowserExchangeRequestDto
  ): Promise<AuthResponseDto> {
    const validated = await googleBrowserExchangeSchema.validate(body, {
      abortEarly: false,
    });
    const auth = this.googleBrowserAuth.redeemExchangeCode(validated.code);
    if (!auth) {
      throw new UnauthorizedException({
        code: "GOOGLE_EXCHANGE_EXPIRED",
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }
    return auth;
  }

  private withQuery(url: string, query: string): string {
    return `${url}${url.includes("?") ? "&" : "?"}${query}`;
  }

  @Post("facebook")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async facebook(
    @Body() body: FacebookAuthRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<AuthResponseDto> {
    const validated = await facebookAuthSchema.validate(body, {
      abortEarly: false,
    });
    const profile = await this.facebookAuthVerifier.verify(
      validated.accessToken
    );

    const claimToken = validated.claimToken
      ? String(validated.claimToken).trim()
      : undefined;
    const { authResponse, rawRefreshToken } =
      await this.authService.facebookLogin(
        profile,
        req.cookies?.rt,
        claimToken
      );

    this.setRefreshCookie(res, rawRefreshToken);
    return this.withNativeRefreshToken(authResponse, rawRefreshToken, req);
  }

  // Native clients (mobile app) send the refresh token in the x-refresh-token header because they
  // cannot use HttpOnly cookies; the rotated token is then returned in the body so they can persist it
  private refreshTokenFrom(request: Request): string | undefined {
    const headerToken = request.headers["x-refresh-token"];
    if (typeof headerToken === "string" && headerToken.length > 0) {
      return headerToken;
    }
    return request.cookies?.rt;
  }

  private isNativeClient(request: Request): boolean {
    return request.headers["x-client"] === "native";
  }

  // Browsers keep the refresh token in an HttpOnly cookie only; leaking it into the body would make it
  // readable by XSS, so it is attached exclusively for the declared native client
  private withNativeRefreshToken(
    authResponse: AuthResponseDto,
    rawRefreshToken: string,
    request: Request
  ): AuthResponseDto {
    return this.isNativeClient(request)
      ? { ...authResponse, refreshToken: rawRefreshToken }
      : authResponse;
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginGuard, AuthRateLimitGuard)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<RefreshTokenResponseDto> {
    const viaHeader = typeof req.headers["x-refresh-token"] === "string";
    try {
      const { tokens, rawRefreshToken } = await this.authService.refresh(
        this.refreshTokenFrom(req)
      );
      this.setRefreshCookie(res, rawRefreshToken);
      return viaHeader ? { ...tokens, refreshToken: rawRefreshToken } : tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) this.clearRefreshCookie(res);
      throw error;
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginGuard, AuthRateLimitGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<void> {
    await this.authService.logout(this.refreshTokenFrom(req));
    this.clearRefreshCookie(res);
  }

  private setRefreshCookie(res: Response, rawRefreshToken: string): void {
    const refreshTtlDays = Number(
      this.configService.get("REFRESH_TOKEN_TTL_DAYS", 30)
    );
    res.cookie("rt", rawRefreshToken, {
      ...this.refreshCookieOptions(),
      maxAge: refreshTtlDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.cookie("rt", "", { ...this.refreshCookieOptions(), maxAge: 0 });
  }

  private refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.get("NODE_ENV") === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
    };
  }
}
