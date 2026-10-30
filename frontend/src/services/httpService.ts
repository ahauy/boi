import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import type { RefreshTokenResponseDto } from "@palmsight/shared";
import { AUTH_REFRESH_URL } from "@/consts/apiUrl";

// Key written by older builds; removed once on load so no stale token is ever sent
const LEGACY_TOKEN_KEY = "token";
// Cached profile (never a token) so a reload can render private pages before the refresh returns
export const USER_KEY = "user";
const REFRESH_LOCK_NAME = "palmsight-refresh";

interface AuthHandlers {
  onTokenRefreshed?: (accessToken: string) => void;
  onSessionExpired?: () => void;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const errorCodeOf = (error: AxiosError) =>
  (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;

class Services {
  axios: AxiosInstance;
  // Access token lives in memory only (api-contract.md "Xác thực"); the refresh token is an HttpOnly cookie
  private inMemoryToken: string | null = null;
  private pendingRefresh: Promise<string> | null = null;
  // Bumped on logout so a refresh still in flight cannot log the user back in
  private sessionEpoch = 0;
  private handlers: AuthHandlers = {};

  constructor() {
    this.axios = axios.create({
      withCredentials: true,
    });

    try {
      window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
      // Storage may be unavailable (private mode); nothing to clean up then
    }

    //! Interceptor request
    this.axios.interceptors.request.use((config) => {
      if (this.inMemoryToken && config.headers) {
        config.headers.Authorization = `Bearer ${this.inMemoryToken}`;
      }
      return config;
    });

    //! Interceptor response: refresh once on TOKEN_EXPIRED (or a token-less request), end the session on UNAUTHENTICATED
    this.axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as RetriableConfig | undefined;
        // /auth/* answers 401 for its own reasons (wrong password, missing cookie): never refresh on those
        if (error.response?.status !== 401 || !config || config.url?.includes("/auth/")) {
          return Promise.reject(error);
        }

        // A request sent before the session restore finished (cached user, no token yet) also deserves one refresh
        const sentWithoutToken = !config.headers?.Authorization;
        if ((errorCodeOf(error) === "TOKEN_EXPIRED" || sentWithoutToken) && !config._retry) {
          config._retry = true;
          try {
            await this.refreshAccessToken();
          } catch {
            this.handlers.onSessionExpired?.();
            return Promise.reject(error);
          }
          return this.axios(config);
        }

        this.handlers.onSessionExpired?.();
        return Promise.reject(error);
      }
    );
  }

  setAuthHandlers(handlers: AuthHandlers) {
    this.handlers = handlers;
  }

  /**
   * The only way the app refreshes. The backend treats two refreshes with the same cookie as token
   * theft and ends every session, so callers in this tab share one request and tabs take turns via a
   * Web Lock (the next tab then sends the already-rotated cookie).
   */
  refreshAccessToken(): Promise<string> {
    if (!this.pendingRefresh) {
      const epoch = this.sessionEpoch;
      const doRefresh = async () => {
        const response = await this.axios.post<RefreshTokenResponseDto>(
          AUTH_REFRESH_URL,
          null,
          { timeout: 5000 }
        );
        if (epoch !== this.sessionEpoch) throw new Error("Session ended while refreshing");
        this.inMemoryToken = response.data.accessToken;
        this.handlers.onTokenRefreshed?.(response.data.accessToken);
        return response.data.accessToken;
      };
      const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
      this.pendingRefresh = (
        locks ? locks.request(REFRESH_LOCK_NAME, doRefresh) : doRefresh()
      ).finally(() => {
        this.pendingRefresh = null;
      });
    }
    return this.pendingRefresh;
  }

  clearSession() {
    this.sessionEpoch += 1;
    this.inMemoryToken = null;
    this.clearStorage();
  }

  setInMemoryToken(token: string | null) {
    this.inMemoryToken = token;
  }

  getInMemoryToken(): string | null {
    return this.inMemoryToken;
  }

  get(url: string, config?: AxiosRequestConfig) {
    return this.axios.get(url, config);
  }

  post(url: string, data: any, config?: AxiosRequestConfig) {
    return this.axios.post(url, data, config);
  }

  delete(url: string, config?: AxiosRequestConfig) {
    return this.axios.delete(url, config);
  }

  put(url: string, data: any, config?: AxiosRequestConfig) {
    return this.axios.put(url, data, config);
  }

  clearStorage() {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(USER_KEY);
    }
  }

  saveUserStorage(user: any) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  getUserStorage() {
    if (typeof localStorage !== "undefined" && localStorage.getItem(USER_KEY)) {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY) || "");
      } catch {
        return null;
      }
    }

    return null;
  }
}

export default new Services();
