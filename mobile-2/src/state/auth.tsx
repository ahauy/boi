import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { UserDto } from '@palmsight/shared';
import * as api from '../lib/api';
import * as authApi from '../lib/authApi';
import { getDeviceId } from '../lib/deviceId';
import { fetchMe } from '../lib/users';
import { billingStore } from '../billing/billing-store';
import { onVerifiedPurchase, setCurrentBillingRef } from '../billing/billing-service';
import { loadPaywallDeclines, syncPaywallVipState } from '../premium/paywall-triggers';
import { setInterstitialVipState } from '../ads/interstitial-policy';
import { setRewardedBalanceListener } from '../ads/rewarded';
import { t } from '../i18n';

type AuthStatus = 'loading' | 'ready' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  /** Lỗi mạng/máy chủ khi mở app — màn hình gốc hiện nút thử lại */
  error: string | null;
  retry(): Promise<void>;
  refreshUser(): Promise<void>;
  /** Ghi ngay user mà endpoint trả về (sửa hồ sơ) vào cache, không chờ gọi lại /me */
  applyUserUpdate(next: UserDto): void;
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
        error: t('error.session'),
      };
    }
  })().finally(() => {
    inflightSession = null;
  });

  return inflightSession;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function syncVipGates(vipKnown: boolean, isVip: boolean): void {
  syncPaywallVipState({ vipKnown, isVip });
  setInterstitialVipState({ vipKnown, isVip });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncUserMonetizationState = useCallback((nextUser: UserDto | null) => {
    if (!nextUser) {
      setCurrentBillingRef(null);
      syncVipGates(false, false);
      return;
    }

    setCurrentBillingRef(nextUser.billingRef ?? null);
    syncVipGates(true, Boolean(nextUser.vip?.active));

    if (nextUser.grantedNow && nextUser.vipDailyGranted) {
      billingStore.setState({ vipGiftBannerAmount: nextUser.vipDailyGranted });
    }
  }, []);

  const applyResult = useCallback(
    (result: SessionResult) => {
      if ('user' in result) {
        setUser(result.user);
        setError(null);
        setStatus('ready');
        syncUserMonetizationState(result.user);
        return;
      }
      setUser(null);
      setError(result.error);
      setStatus('error');
      syncUserMonetizationState(null);
    },
    [syncUserMonetizationState]
  );

  const refreshUser = useCallback(async () => {
    const fresh = await fetchMe();
    setUser(fresh);
    syncUserMonetizationState(fresh);
  }, [syncUserMonetizationState]);

  useEffect(() => {
    void loadPaywallDeclines();
    let cancelled = false;
    void (async () => {
      const result = await resolveSession();
      if (!cancelled) applyResult(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  // Playbook §6.5: VIP from verify is written to the /v1/me cache immediately (ads stop at once), then refetched.
  useEffect(
    () =>
      onVerifiedPurchase((res) => {
        setCurrentBillingRef(res.billingRef);
        syncVipGates(true, Boolean(res.vip?.active));
        setUser((current) =>
          current
            ? {
                ...current,
                vip: res.vip,
                creditBalance: res.balance,
                balance: res.balance,
                billingRef: res.billingRef,
              }
            : current
        );
        void refreshUser().catch(() => {
          // Ignore background refetch error since cache was already updated
        });
      }),
    [refreshUser]
  );

  const applyUserUpdate = useCallback((next: UserDto) => {
    // Gộp lên user cũ: các trường chỉ có ở lần mở phiên (grantedNow...) không bị mất
    setUser((current) => (current ? { ...current, ...next } : next));
  }, []);

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
        syncUserMonetizationState(null);
        void resolveSession().then(applyResult);
      }),
    [applyResult, syncUserMonetizationState]
  );

  const setCreditBalance = useCallback((balance: number) => {
    setUser((current) =>
      current ? { ...current, creditBalance: balance, balance } : current
    );
  }, []);

  useEffect(() => {
    setRewardedBalanceListener(setCreditBalance);
    return () => setRewardedBalanceListener(null);
  }, [setCreditBalance]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, retry, refreshUser, applyUserUpdate, setCreditBalance }),
    [status, user, error, retry, refreshUser, applyUserUpdate, setCreditBalance]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải nằm trong AuthProvider');
  return context;
}
