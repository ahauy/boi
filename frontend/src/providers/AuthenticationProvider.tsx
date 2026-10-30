import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import httpService from "@/services/httpService";
import authService from "@/services/authService";
import useAuthStore from "@/stores/useAuthStore";
import { ME_URL } from "@/consts/apiUrl";
import type {
  MeResponseDto,
  UserSummaryDto,
  UserReferralInfoDto,
  AuthProvider,
} from "@palmsight/shared";

export type AuthUser = UserSummaryDto & {
  email?: string | null;
  firstname?: string;
  lastname?: string;
  roles?: string[];
  isFirstTimeLogin?: boolean;
  hasPassword?: boolean;
  providers?: AuthProvider[];
  referral?: UserReferralInfoDto;
  referralLink?: string;
  avatar?: string;
};

export interface AuthenticationContextI {
  loading: boolean;
  isLogged: boolean;
  accessToken: string | null;
  user: AuthUser | null;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  setAuthSession: (session: { accessToken: string; user: AuthUser | UserSummaryDto }) => void;
  updateUser: (user: Partial<AuthUser>) => void;
  refreshSession: () => Promise<boolean>;
}

const AuthenticationContext = createContext<AuthenticationContextI>({
  loading: false,
  isLogged: false,
  accessToken: null,
  user: null,
  login: async () => {},
  logout: () => {},
  setAuthSession: () => {},
  updateUser: () => {},
  refreshSession: async () => false,
});

export const useAuth = () => useContext(AuthenticationContext);

interface AuthenticationProviderProps {
  children: ReactNode;
  initialAccessToken?: string | null;
  initialUser?: AuthUser | null;
  skipInitialRefresh?: boolean;
}

/**
 * Safely parse payload from a JWT token in browser / Node environment.
 * Does not verify signature (signature is verified by backend).
 */
export function parseJwt<T = Record<string, any>>(token: string): T | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const decodedStr =
      typeof atob === "function"
        ? atob(padded)
        : typeof Buffer !== "undefined"
          ? Buffer.from(padded, "base64").toString("binary")
          : "";
    if (!decodedStr) return null;
    try {
      const jsonPayload = decodeURIComponent(
        decodedStr
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload) as T;
    } catch {
      return JSON.parse(decodedStr) as T;
    }
  } catch {
    return null;
  }
}

/**
 * Enriches user object with email extracted from JWT token if user has no email.
 */
export const enrichUserWithJwt = (
  user: AuthUser | UserSummaryDto | null,
  token: string | null
): AuthUser | null => {
  if (!user) return null;
  const enriched: AuthUser = { ...user };
  if (!enriched.email && token) {
    const decoded = parseJwt<{ email?: string }>(token);
    if (decoded?.email) {
      enriched.email = decoded.email;
    }
  }
  return enriched;
};

export const AuthenticationProvider = ({
  children,
  initialAccessToken,
  initialUser = null,
  skipInitialRefresh = false,
}: AuthenticationProviderProps) => {
  const resolvedInitialToken =
    initialAccessToken !== undefined
      ? initialAccessToken
      : initialUser && skipInitialRefresh
        ? "test-jwt-token"
        : null;

  const [accessToken, setAccessToken] = useState<string | null>(resolvedInitialToken);
  const [user, setUser] = useState<AuthUser | null>(() => {
    const inMemoryEnriched = enrichUserWithJwt(initialUser, resolvedInitialToken);
    if (inMemoryEnriched) return inMemoryEnriched;
    if (skipInitialRefresh) return null;
    return typeof window !== "undefined"
      ? (httpService.getUserStorage() as AuthUser | null)
      : null;
  });
  const [loading, setLoading] = useState(!resolvedInitialToken && !skipInitialRefresh);

  const clearSession = useCallback(() => {
    httpService.clearSession();
    setAccessToken(null);
    setUser(null);
    useAuthStore.getState().clearAuthSession();
  }, []);

  useEffect(() => {
    if (resolvedInitialToken) httpService.setInMemoryToken(resolvedInitialToken);
    httpService.setAuthHandlers({
      onTokenRefreshed: (token) => {
        setAccessToken(token);
        useAuthStore.setState({ accessToken: token });
      },
      onSessionExpired: clearSession,
    });
    return () => httpService.setAuthHandlers({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSession]);

  const setAuthSession = useCallback(
    (session: { accessToken: string; user: AuthUser | UserSummaryDto }) => {
      const enrichedUser =
        enrichUserWithJwt(session.user, session.accessToken) ||
        (session.user as AuthUser);
      httpService.saveUserStorage(enrichedUser);
      setAccessToken(session.accessToken);
      httpService.setInMemoryToken(session.accessToken);
      setUser(enrichedUser);
      useAuthStore.getState().setAuthSession({
        accessToken: session.accessToken,
        user: enrichedUser,
      });
    },
    []
  );

  const updateUser = useCallback((updatedFields: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      httpService.saveUserStorage(updated);
      return updated;
    });
    useAuthStore.getState().updateUser(updatedFields);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      await authService.postRefresh();
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (skipInitialRefresh || initialAccessToken) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const token = await authService.postRefresh();
        const { data } = await httpService.get(ME_URL);
        if (!isMounted) return;
        setAuthSession({ accessToken: token, user: data as MeResponseDto });
      } catch {
        if (isMounted) clearSession();
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [skipInitialRefresh, initialAccessToken, setAuthSession, clearSession]);

  const login = useCallback(
    async ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => {
      try {
        setLoading(true);
        const data = await authService.postLogin({ login: username, password });
        setAuthSession({
          accessToken: data.accessToken,
          user: data.user,
        });
      } catch (error) {
        console.error(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setAuthSession]
  );

  const logout = useCallback(() => {
    authService.postLogout().catch(() => {});
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear();
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthenticationContextI>(() => {
    return {
      loading,
      isLogged: Boolean(user && (accessToken || loading)),
      accessToken,
      user,
      logout,
      login,
      setAuthSession,
      updateUser,
      refreshSession,
    };
  }, [loading, user, accessToken, logout, login, setAuthSession, updateUser, refreshSession]);

  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  );
};

export default AuthenticationProvider;
