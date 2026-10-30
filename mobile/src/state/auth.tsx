import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthResponseDto, UserDto } from '@palmsight/shared';
import * as api from '../lib/api';
import * as authApi from '../lib/authApi';
import { fetchMe } from '../lib/users';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  /**true khi không gọi được backend lúc mở app (server nguội, mất mạng) — phân biệt với hết đăng nhập*/
  unreachable: boolean;
  signIn(login: string, password: string): Promise<void>;
  signInWithGoogle(idToken: string, claimToken?: string): Promise<void>;
  signInWithFacebook(accessToken: string, claimToken?: string): Promise<void>;
  /** Dùng cho device flow: backend đã xác thực xong và trả phiên hoàn chỉnh */
  completeSignIn(response: AuthResponseDto): Promise<void>;
  signOut(): Promise<void>;
  refreshUser(): Promise<void>;
  /** API trả creditBalance trong mọi response, dùng nó để cập nhật header ngay */
  setCreditBalance(balance: number): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserDto | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const refreshUser = useCallback(async () => {
    setUser(await fetchMe());
  }, []);

  useEffect(() => {
    let cancelled = false;

    // restore: token cũ trong SecureStore có thể đã hết hạn — request() sẽ tự refresh rồi thử lại
    void (async () => {
      const hasSession = await api.loadStoredTokens();
      if (!hasSession) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setUser(me);
        setStatus('signedIn');
      } catch (error) {
        if (cancelled) return;
        // 401 đã được api.ts xử lý (endSession); còn lại là lỗi mạng/server nguội
        setUnreachable(error instanceof api.ApiError && error.status === 0);
        setStatus('signedOut');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => api.onSessionExpired(() => {
    setUser(null);
    setStatus('signedOut');
  }), []);

  // Login email và social login đều đi qua cùng một bước "lập phiên" sau khi backend xác thực xong
  async function establishSession(response: AuthResponseDto): Promise<void> {
    await api.applySession(response.accessToken, response.refreshToken ?? null);
    setUser(await fetchMe());
    setUnreachable(false);
    setStatus('signedIn');
  }

  const signIn = useCallback(async (login: string, password: string) => {
    await establishSession(await authApi.login({ login, password }));
  }, []);

  const signInWithGoogle = useCallback(async (idToken: string, claimToken?: string) => {
    await establishSession(await authApi.loginWithGoogle(idToken, claimToken));
  }, []);

  const signInWithFacebook = useCallback(async (accessToken: string, claimToken?: string) => {
    await establishSession(await authApi.loginWithFacebook(accessToken, claimToken));
  }, []);

  const completeSignIn = useCallback(async (response: AuthResponseDto) => {
    await establishSession(response);
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const setCreditBalance = useCallback((balance: number) => {
    setUser((current) => (current ? { ...current, creditBalance: balance } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      unreachable,
      signIn,
      signInWithGoogle,
      signInWithFacebook,
      completeSignIn,
      signOut,
      refreshUser,
      setCreditBalance,
    }),
    [
      status,
      user,
      unreachable,
      signIn,
      signInWithGoogle,
      signInWithFacebook,
      completeSignIn,
      signOut,
      refreshUser,
      setCreditBalance,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải nằm trong AuthProvider');
  return context;
}
