import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import httpService from './httpService';

type Reply = { status: number; data?: unknown };
type Handler = (config: InternalAxiosRequestConfig) => Reply | Promise<Reply>;

const apiError = (status: number, code: string): Reply => ({
  status,
  data: { error: { code, message: code } },
});

// Fake network layer: lets each test decide the reply per request
const fakeServer = (handler: Handler) => {
  const calls: InternalAxiosRequestConfig[] = [];
  httpService.axios.defaults.adapter = async (config) => {
    calls.push(config);
    const reply = await handler(config);
    const response: AxiosResponse = {
      data: reply.data,
      status: reply.status,
      statusText: '',
      headers: {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  return {
    calls,
    refreshCalls: () => calls.filter((c) => c.url === '/api/v1/auth/refresh').length,
  };
};

const authHeader = (config: InternalAxiosRequestConfig) => config.headers?.Authorization;

describe('httpService token refresh', () => {
  const onTokenRefreshed = vi.fn();
  const onSessionExpired = vi.fn();
  const originalAdapter = httpService.axios.defaults.adapter;

  beforeEach(() => {
    onTokenRefreshed.mockReset();
    onSessionExpired.mockReset();
    httpService.setInMemoryToken('expired-token');
    httpService.setAuthHandlers({ onTokenRefreshed, onSessionExpired });
  });

  afterEach(() => {
    httpService.axios.defaults.adapter = originalAdapter;
    httpService.setAuthHandlers({});
    httpService.setInMemoryToken(null);
    vi.unstubAllGlobals();
  });

  // GET /me answers TOKEN_EXPIRED until it sees the fresh token
  const expiringServer = (refreshReply: Reply = { status: 200, data: { accessToken: 'fresh-token', expiresIn: 900 } }) =>
    fakeServer((config) => {
      if (config.url === '/api/v1/auth/refresh') return refreshReply;
      if (authHeader(config) === 'Bearer fresh-token') return { status: 200, data: { ok: config.url } };
      return apiError(401, 'TOKEN_EXPIRED');
    });

  it('refreshes once on TOKEN_EXPIRED and retries the request with the new token', async () => {
    const server = expiringServer();

    const res = await httpService.get('/api/v1/me');

    expect(res.data).toEqual({ ok: '/api/v1/me' });
    expect(server.refreshCalls()).toBe(1);
    expect(authHeader(server.calls[server.calls.length - 1])).toBe('Bearer fresh-token');
    expect(httpService.getInMemoryToken()).toBe('fresh-token');
    expect(onTokenRefreshed).toHaveBeenCalledWith('fresh-token');
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('shares one refresh between concurrent requests that hit TOKEN_EXPIRED', async () => {
    const server = expiringServer();

    const results = await Promise.all([
      httpService.get('/api/v1/me'),
      httpService.get('/api/v1/me/credit-transactions'),
      httpService.get('/api/v1/readings'),
    ]);

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(server.refreshCalls()).toBe(1);
  });

  it('ends the session and rejects when the refresh itself fails', async () => {
    const server = expiringServer(apiError(401, 'UNAUTHENTICATED'));

    await expect(httpService.get('/api/v1/me')).rejects.toBeInstanceOf(AxiosError);
    expect(server.refreshCalls()).toBe(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('ends the session without refreshing on UNAUTHENTICATED', async () => {
    const server = fakeServer(() => apiError(401, 'UNAUTHENTICATED'));

    await expect(httpService.get('/api/v1/me')).rejects.toBeInstanceOf(AxiosError);
    expect(server.refreshCalls()).toBe(0);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('refreshes and retries a request sent before any token was available', async () => {
    httpService.setInMemoryToken(null);
    const server = fakeServer((config) => {
      if (config.url === '/api/v1/auth/refresh') {
        return { status: 200, data: { accessToken: 'fresh-token', expiresIn: 900 } };
      }
      return authHeader(config) === 'Bearer fresh-token'
        ? { status: 200, data: { ok: config.url } }
        : apiError(401, 'UNAUTHENTICATED');
    });

    const res = await httpService.get('/api/v1/me');

    expect(res.data).toEqual({ ok: '/api/v1/me' });
    expect(server.refreshCalls()).toBe(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('does not loop when the retried request is rejected again', async () => {
    const server = fakeServer((config) =>
      config.url === '/api/v1/auth/refresh'
        ? { status: 200, data: { accessToken: 'fresh-token', expiresIn: 900 } }
        : apiError(401, 'TOKEN_EXPIRED')
    );

    await expect(httpService.get('/api/v1/me')).rejects.toBeInstanceOf(AxiosError);
    expect(server.refreshCalls()).toBe(1);
    expect(server.calls.filter((c) => c.url === '/api/v1/me')).toHaveLength(2);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('leaves 401s from /auth/* (e.g. wrong password) to the caller', async () => {
    const server = fakeServer(() => apiError(401, 'INVALID_CREDENTIALS'));

    await expect(httpService.post('/api/v1/auth/login', { login: 'a', password: 'b' })).rejects.toBeInstanceOf(
      AxiosError
    );
    expect(server.refreshCalls()).toBe(0);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('runs the refresh inside the cross-tab "palmsight-refresh" Web Lock', async () => {
    const request = vi.fn((_name: string, callback: () => Promise<unknown>) => callback());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    expiringServer();

    await httpService.get('/api/v1/me');

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('palmsight-refresh');
  });

  it('ignores a refresh that finishes after the session was cleared (logout)', async () => {
    let finishRefresh!: () => void;
    fakeServer((config) =>
      config.url === '/api/v1/auth/refresh'
        ? new Promise<Reply>((resolve) => {
            finishRefresh = () => resolve({ status: 200, data: { accessToken: 'late-token', expiresIn: 900 } });
          })
        : { status: 200 }
    );

    const refresh = httpService.refreshAccessToken();
    await vi.waitFor(() => expect(finishRefresh).toBeTypeOf('function'));
    httpService.clearSession();
    finishRefresh();

    await expect(refresh).rejects.toThrow();
    expect(httpService.getInMemoryToken()).toBeNull();
    expect(onTokenRefreshed).not.toHaveBeenCalled();
  });

  it('configures a 5000ms timeout on the refresh request to avoid blocking indefinitely', async () => {
    let refreshConfig: InternalAxiosRequestConfig | undefined;
    fakeServer((config) => {
      if (config.url === '/api/v1/auth/refresh') {
        refreshConfig = config;
        return { status: 200, data: { accessToken: 'fresh-token', expiresIn: 900 } };
      }
      return { status: 200 };
    });

    await httpService.refreshAccessToken();
    expect(refreshConfig?.timeout).toBe(5000);
  });
});
