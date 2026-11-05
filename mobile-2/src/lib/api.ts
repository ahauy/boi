import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { ApiErrorResponse, RefreshTokenResponseDto } from '@palmsight/shared';
import { t } from '../i18n';
import * as tokenStore from './tokenStore';
import { getDeviceId } from './deviceId';

function resolveApiBaseUrl(): string {
  const raw = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');
  if (Platform.OS !== 'web' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(raw)) {
    const hostUri =
      Constants.expoConfig?.hostUri ??
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
      (Constants as any).manifest?.debuggerHost ??
      '';
    const lanHost = typeof hostUri === 'string' ? hostUri.split(':')[0]?.trim() : '';
    if (lanHost && lanHost !== 'localhost' && lanHost !== '127.0.0.1') {
      return raw.replace(/\/\/(localhost|127\.0\.0\.1)/i, `//${lanHost}`);
    }
  }
  return raw;
}

export const API_BASE_URL = resolveApiBaseUrl();

const DEFAULT_TIMEOUT_MS = 20_000;
const REFRESH_TIMEOUT_MS = 15_000;

const NETWORK_ERROR = 'NETWORK_ERROR';
const TIMEOUT_ERROR = 'TIMEOUT';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> = {},
    details: Record<string, unknown> = {},
    /**
     * Lỗi gốc từ fetch. Mọi thất bại đều bị đóng dấu "không kết nối được máy chủ", nên nếu không giữ
     * lại nguyên nhân thì một bug mã hoá request cũng trông hệt như mất mạng.
     */
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Gửi kèm access token (mặc định true). Endpoint /auth/* không cần. */
  auth?: boolean;
  /**
   * Cho phép thử lại một lần khi không kết nối được. Chỉ bật cho request an toàn khi lặp lại:
   * GET, hoặc POST mà server tự nhận diện trùng (như /auth/device theo deviceId).
   */
  retryOnNetworkError?: boolean;
}

let accessToken: string | null = null;
let pendingRefresh: Promise<string | null> | null = null;
// Tăng mỗi lần kết thúc phiên để một refresh đang chạy không khôi phục lại phiên cũ
let sessionEpoch = 0;
const expiredListeners = new Set<() => void>();

function endSession(): void {
  sessionEpoch += 1;
  accessToken = null;
  void tokenStore.clearSession();
  for (const listener of [...expiredListeners]) listener();
}

/**
 * Kết thúc phiên cục bộ sau khi server đã xoá tài khoản: bỏ token trong bộ nhớ và SecureStore,
 * rồi báo cho AuthProvider mở phiên khách mới (thiết bị cũ không được nhận lại quà khởi đầu).
 */
export function endLocalSession(): void {
  endSession();
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

/** Nạp token đã lưu để request đầu tiên của phiên được mang Authorization. */
export async function loadStoredTokens(): Promise<boolean> {
  // Hai khoá đọc song song: mỗi lượt chạm Keystore Android tốn hàng chục ms và nó chặn màn đầu tiên.
  const [storedAccess, storedRefresh] = await Promise.all([tokenStore.getAccessToken(), tokenStore.getRefreshToken()]);
  accessToken = storedAccess;
  return Boolean(storedAccess || storedRefresh);
}

/** Đăng nhập thành công: giữ token trong bộ nhớ và trong SecureStore. */
export async function applySession(nextAccessToken: string, refreshToken?: string | null): Promise<void> {
  accessToken = nextAccessToken;
  await tokenStore.saveSession(nextAccessToken, refreshToken ?? null);
}

/**
 * Luồng refresh duy nhất của app. Backend coi hai lần refresh bằng cùng một token là đánh cắp
 * token và huỷ mọi phiên, nên mọi request phải dùng chung một promise.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh;

  const epoch = sessionEpoch;
  pendingRefresh = (async () => {
    const refreshToken = await tokenStore.getRefreshToken();
    if (!refreshToken) return null;

    const response = await send('/auth/refresh', {
      method: 'POST',
      headers: { 'x-refresh-token': refreshToken },
      timeoutMs: REFRESH_TIMEOUT_MS,
      auth: false,
    });
    if (!response.ok) return null;

    const data = (await response.json()) as RefreshTokenResponseDto;
    // App luôn gửi `x-refresh-token` nên backend luôn trả token mới xoay vòng. Không có nó nghĩa là
    // server đã đi theo đường cookie: token cũ trong SecureStore đã hết hiệu lực, giữ lại chỉ chuốc
    // thêm lỗi "dùng lại refresh token" -> thu hồi mọi phiên.
    // Đăng xuất trong lúc refresh đang chạy: bỏ kết quả, không tái tạo phiên
    if (!data?.accessToken || !data.refreshToken || epoch !== sessionEpoch) return null;

    accessToken = data.accessToken;
    await tokenStore.saveSession(data.accessToken, data.refreshToken);
    return accessToken;
  })()
    .catch((error) => {
      // Mất mạng/quá hạn lúc refresh: phiên vẫn còn giá trị, ném lỗi lên cho màn hình hiển thị
      // "đang đánh thức máy chủ" thay vì đá người dùng về login
      if (error instanceof ApiError && error.status === 0) throw error;
      return null;
    })
    .finally(() => {
      pendingRefresh = null;
    });

  return pendingRefresh;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const deviceId = await getDeviceId().catch(() => null);
  const headers: Record<string, string> = {
    'x-client': 'native',
    ...(deviceId ? { 'x-device-id': deviceId } : {}),
    ...options.headers,
  };

  let body: RequestInit['body'];
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const token = options.auth === false ? null : accessToken;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError';
    throw new ApiError(
      0,
      aborted ? TIMEOUT_ERROR : NETWORK_ERROR,
      t(aborted ? 'error.timeout' : 'error.network'),
      {},
      {},
      error
    );
  } finally {
    clearTimeout(timer);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = 'UNKNOWN';
  let message = t('error.generic');
  const fields: Record<string, string> = {};
  let details: Record<string, unknown> = {};
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    if (payload?.error) {
      code = payload.error.code ?? code;
      message = payload.error.message ?? message;
      for (const field of payload.error.details?.fields ?? []) fields[field.field] = field.message;
      if (payload.error.details) details = payload.error.details;
    }
  } catch {
    //Body không phải JSON (proxy/ngrok trả HTML): giữ mã lỗi chung
  }
  return new ApiError(response.status, code, message, fields, details);
}

/** Render gói miễn phí ngủ sau ~15 phút không có traffic; đánh thức nó lâu hơn một nhịp timeout. */
const COLD_START_RETRY_DELAY_MS = 1500;

function isNetworkFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

function mayRetry(options: RequestOptions): boolean {
  if (options.form) return false;
  return options.retryOnNetworkError === true || (options.method ?? 'GET') === 'GET';
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await send(path, options);
  } catch (error) {
    // Lần gọi đầu sau một khoảng im lặng chết vì máy chủ đang tỉnh dậy, không phải vì hết mạng.
    // Không thử lại thì người dùng thấy "không kết nối được" và phải tự bấm lại, mất thêm 20 giây.
    if (!isNetworkFailure(error) || !mayRetry(options)) throw error;
    await new Promise((resolve) => setTimeout(resolve, COLD_START_RETRY_DELAY_MS));
    response = await send(path, options);
  }

  if (response.status === 401 && options.auth !== false) {
    // TOKEN_EXPIRED: làm mới rồi thử lại đúng một lần. UNAUTHENTICATED (hoặc hết session): về login.
    const code = await peekErrorCode(response);
    if (code === 'TOKEN_EXPIRED') {
      const token = await refreshAccessToken();
      if (!token) {
        endSession();
        throw await toApiError(response);
      }
      return finalize<T>(await send(path, options));
    }
    endSession();
    throw await toApiError(response);
  }

  return finalize<T>(response);
}

async function finalize<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  if (!response.ok) throw await toApiError(response);

  const text = await response.text();
  return (text ? (JSON.parse(text) as T) : undefined) as T;
}

// Đã đọc body để lấy mã lỗi thì không đọc lại được: clone trước khi tiêu thụ
async function peekErrorCode(response: Response): Promise<string | undefined> {
  try {
    const payload = (await response.clone().json()) as ApiErrorResponse;
    return payload?.error?.code;
  } catch {
    return undefined;
  }
}

export function get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body' | 'form'>) {
  return request<T>(path, { ...options, method: 'GET' });
}

export function post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body' | 'form'>) {
  return request<T>(path, { ...options, method: 'POST', body });
}

export function put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body' | 'form'>) {
  return request<T>(path, { ...options, method: 'PUT', body });
}

export function patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body' | 'form'>) {
  return request<T>(path, { ...options, method: 'PATCH', body });
}

export function del<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body' | 'form'>) {
  return request<T>(path, { ...options, method: 'DELETE' });
}

export function upload<T>(
  path: string,
  form: FormData,
  options?: Omit<RequestOptions, 'method' | 'form' | 'body'>
) {
  return request<T>(path, { ...options, method: 'POST', form });
}
