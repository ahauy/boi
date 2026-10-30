import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import type { AuthResponseDto } from "@palmsight/shared";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REQUEST_TIMEOUT_MS = 15_000;
const STATE_TTL_MS = 10 * 60_000;
const EXCHANGE_TTL_MS = 2 * 60_000;

interface PendingState {
  nativeRedirect: string;
  claimToken?: string;
  expiresAt: number;
}

interface PendingExchange {
  auth: AuthResponseDto;
  expiresAt: number;
}

interface GoogleTokenResponse {
  id_token?: string;
  error?: string;
}

/**
 * OAuth trung gian cho Expo Go: app mở trang Google với redirect về backend (https công khai),
 * backend tạo phiên rồi chuyển tiếp về app qua deep link exp:// kèm mã dùng một lần.
 * Trạng thái nằm trong bộ nhớ — chạy một instance backend.
 */
@Injectable()
export class GoogleBrowserAuthService {
  private readonly states = new Map<string, PendingState>();
  private readonly exchanges = new Map<string, PendingExchange>();
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri?: string;

  constructor(configService: ConfigService) {
    this.clientId =
      configService.get<string>("GOOGLE_CLIENT_ID")?.trim() || undefined;
    this.clientSecret =
      configService.get<string>("GOOGLE_CLIENT_SECRET")?.trim() || undefined;
    this.redirectUri =
      configService.get<string>("GOOGLE_OAUTH_REDIRECT_URI")?.trim() ||
      undefined;
  }

  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  createAuthorizationUrl(nativeRedirect: string, claimToken?: string): string {
    if (!this.configured) {
      throw new ServiceUnavailableException({
        code: "GOOGLE_BROWSER_NOT_CONFIGURED",
        message:
          "Đăng nhập Google qua trình duyệt chưa được cấu hình trên máy chủ.",
      });
    }

    this.prune();
    const state = randomUUID();
    this.states.set(state, {
      nativeRedirect,
      claimToken,
      expiresAt: Date.now() + STATE_TTL_MS,
    });

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", this.clientId!);
    url.searchParams.set("redirect_uri", this.redirectUri!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  consumeState(state: string): PendingState | null {
    this.prune();
    const entry = this.states.get(state);
    if (!entry) return null;
    this.states.delete(state);
    return entry;
  }

  async exchangeCode(code: string): Promise<string> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: this.redirectUri!,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch(() => {
      throw new BadGatewayException({
        code: "GOOGLE_OAUTH_UNAVAILABLE",
        message: "Không kết nối được tới Google. Vui lòng thử lại.",
      });
    });

    const payload = (await response.json()) as GoogleTokenResponse;
    if (!response.ok || !payload.id_token) {
      throw new BadGatewayException({
        code: "GOOGLE_OAUTH_UNAVAILABLE",
        message: "Không xác minh được tài khoản Google. Vui lòng thử lại.",
      });
    }
    return payload.id_token;
  }

  createExchangeCode(auth: AuthResponseDto): string {
    this.prune();
    const code = randomUUID();
    this.exchanges.set(code, {
      auth,
      expiresAt: Date.now() + EXCHANGE_TTL_MS,
    });
    return code;
  }

  redeemExchangeCode(code: string): AuthResponseDto | null {
    this.prune();
    const entry = this.exchanges.get(code);
    if (!entry) return null;
    this.exchanges.delete(code);
    return entry.auth;
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.states) {
      if (entry.expiresAt <= now) this.states.delete(key);
    }
    for (const [key, entry] of this.exchanges) {
      if (entry.expiresAt <= now) this.exchanges.delete(key);
    }
  }
}
