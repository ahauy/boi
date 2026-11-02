import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { UserDto } from '@palmsight/shared';
import * as api from '../lib/api';
import * as authApi from '../lib/authApi';
import { getDeviceId } from '../lib/deviceId';
import { fetchMe } from '../lib/users';

type AuthStatus = 'loading' | 'ready' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  /** Lỗi mạng/máy chủ khi mở app — màn hình gốc hiện nút thử lại */
  error: string | null;
  retry(): Promise<void>;
  refreshUser(): Promise<void>;
  /** API trả creditBalance trong mọi response, dùng nó để cập nhật header ngay */
  setCreditBalance(balance: number): void;
}

type SessionResult = { user: UserDto } | { error: string };

let inflightSession: Promise<SessionResult> | null = null;

// Mở phiên: token cũ còn dùng được thì giữ, không thì đổi mã thiết bị lấy tài khoản khách
async function resolveSession(): Promise<SessionResult> {
  if (inflightSession) return inflightSession;

  inflightSession = (async (): Promise<SessionResult> => {
    try {
      const hasSession = await api.loadStoredTokens();
      if (hasSession) {
        try {
          return { user: await fetchMe() };
        } catch (cause) {
          // Token hỏng đã được api.ts xoá; mất mạng thì báo lỗi để người dùng thử lại
          if (!(cause instanceof api.ApiError) || cause.status !== 401) throw cause;
        }
      }

      const response = await authApi.createDeviceSession(await getDeviceId());
      await api.applySession(response.accessToken, response.refreshToken ?? null);
      return { user: await fetchMe() };
    } catch (cause) {
      // ApiError nghĩa là đã chạm tới máy chủ (status != 0) hoặc không nối được (status == 0);
      // message của nó đã đúng hoàn cảnh. Ngoài ApiError thì đây là lỗi của chính app — báo kiểu
      // "không thể kết nối" sẽ đẩy người dùng đi kiểm tra Wi-Fi trong khi Wi-Fi không có lỗi.
      if (cause instanceof api.ApiError) {
        return { error: cause.message };
      }
      console.warn('[session] lỗi không mong đợi khi mở phiên:', cause);
      return {
        error: 'Không mở được phiên trên thiết bị này. Vui lòng thử lại hoặc cài đặt lại app.',
      };
    }
  })().finally(() => {
    inflightSession = null;
  });

  return inflightSession;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyResult = useCallback((result: SessionResult) => {
    if ('user' in result) {
      setUser(result.user);
      setError(null);
      setStatus('ready');
      return;
    }
    setUser(null);
    setError(result.error);
    setStatus('error');
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await fetchMe());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await resolveSession();
      if (!cancelled) applyResult(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  const retry = useCallback(async () => {
    setStatus('loading');
    setError(null);
    applyResult(await resolveSession());
  }, [applyResult]);

  // Refresh token hết hiệu lực (đổi máy, xoá dữ liệu server): tự mở phiên khách mới
  useEffect(
    () =>
      api.onSessionExpired(() => {
        setUser(null);
        setStatus('loading');
        void resolveSession().then(applyResult);
      }),
    [applyResult]
  );

  const setCreditBalance = useCallback((balance: number) => {
    setUser((current) => (current ? { ...current, creditBalance: balance } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, retry, refreshUser, setCreditBalance }),
    [status, user, error, retry, refreshUser, setCreditBalance]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải nằm trong AuthProvider');
  return context;
}
