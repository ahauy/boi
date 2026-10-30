import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PrivateRoute from '@/components/PrivateRoute';
import { AuthenticationProvider, useAuth } from './AuthenticationProvider';
import httpService from '@/services/httpService';
import authService from '@/services/authService';

const TestConsumer = () => {
  const { isLogged, accessToken, user, setAuthSession, logout } = useAuth();
  return (
    <div>
      <div data-testid="is-logged">{String(isLogged)}</div>
      <div data-testid="access-token">{accessToken || 'null'}</div>
      <div data-testid="user-name">{user?.displayName || 'null'}</div>
      <div data-testid="user-credits">{user?.creditBalance ?? 'null'}</div>
      <button
        onClick={() =>
          setAuthSession({
            accessToken: 'test-jwt-token',
            user: {
              id: '6710a1b2c3d4e5f6a7b8c9d0',
              displayName: 'Nguyễn Văn A',
              username: 'nguyenvana',
              avatarUrl: null,
              creditBalance: 3,
              referralCode: 'K7QX4MZP',
            },
          })
        }
      >
        Set Session
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthenticationProvider (In-Memory Token)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    httpService.setInMemoryToken(null);
    vi.restoreAllMocks();
  });

  it('should initialize with unauthenticated in-memory state', () => {
    render(
      <AuthenticationProvider skipInitialRefresh>
        <TestConsumer />
      </AuthenticationProvider>
    );

    expect(screen.getByTestId('is-logged').textContent).toBe('false');
    expect(screen.getByTestId('access-token').textContent).toBe('null');
    expect(screen.getByTestId('user-name').textContent).toBe('null');
  });

  it('should store accessToken in memory ONLY (never in localStorage)', async () => {
    render(
      <AuthenticationProvider skipInitialRefresh>
        <TestConsumer />
      </AuthenticationProvider>
    );

    // Set authenticated session
    await act(async () => {
      screen.getByText('Set Session').click();
    });

    // In-memory state updated
    expect(screen.getByTestId('is-logged').textContent).toBe('true');
    expect(screen.getByTestId('access-token').textContent).toBe('test-jwt-token');
    expect(screen.getByTestId('user-name').textContent).toBe('Nguyễn Văn A');
    expect(screen.getByTestId('user-credits').textContent).toBe('3');

    // Security check: localStorage must NOT contain the access token
    expect(localStorage.getItem('token')).toBeNull();
    // httpService in-memory getter should return the token
    expect(httpService.getInMemoryToken()).toBe('test-jwt-token');
  });

  it('should clear in-memory state and httpService on logout', async () => {
    vi.spyOn(authService, 'postLogout').mockResolvedValue(undefined);

    render(
      <AuthenticationProvider skipInitialRefresh>
        <TestConsumer />
      </AuthenticationProvider>
    );

    // Log in
    await act(async () => {
      screen.getByText('Set Session').click();
    });
    expect(screen.getByTestId('is-logged').textContent).toBe('true');

    // Logout
    await act(async () => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('is-logged').textContent).toBe('false');
    expect(screen.getByTestId('access-token').textContent).toBe('null');
    expect(screen.getByTestId('user-name').textContent).toBe('null');
    expect(httpService.getInMemoryToken()).toBeNull();
  });

  describe('parseJwt & email extraction', () => {
    const makeMockJwt = (payload: Record<string, any>) => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return `${header}.${body}.mock-signature`;
    };

    it('should safely extract email from JWT payload when setting auth session without email', async () => {
      const validJwt = makeMockJwt({
        sub: '6710a1b2c3d4e5f6a7b8c9d0',
        email: 'palmsight.user@example.com',
        username: 'nguyenvana',
      });

      const EmailConsumer = () => {
        const { user, setAuthSession } = useAuth();
        return (
          <div>
            <div data-testid="user-email">{user?.email || 'no-email'}</div>
            <button
              onClick={() =>
                setAuthSession({
                  accessToken: validJwt,
                  user: {
                    id: '6710a1b2c3d4e5f6a7b8c9d0',
                    displayName: 'Nguyễn Văn A',
                    username: 'nguyenvana',
                    avatarUrl: null,
                    creditBalance: 3,
                    referralCode: 'K7QX4MZP',
                  },
                })
              }
            >
              Login With JWT
            </button>
          </div>
        );
      };

      render(
        <AuthenticationProvider skipInitialRefresh>
          <EmailConsumer />
        </AuthenticationProvider>
      );

      expect(screen.getByTestId('user-email').textContent).toBe('no-email');

      await act(async () => {
        screen.getByText('Login With JWT').click();
      });

      expect(screen.getByTestId('user-email').textContent).toBe('palmsight.user@example.com');
    });

    it('should initialize user with email extracted from initialAccessToken', () => {
      const validJwt = makeMockJwt({
        sub: '6710a1b2c3d4e5f6a7b8c9d0',
        email: 'initial.jwt@example.com',
        username: 'initialuser',
      });

      const EmailConsumer = () => {
        const { user } = useAuth();
        return <div data-testid="user-email">{user?.email || 'no-email'}</div>;
      };

      render(
        <AuthenticationProvider
          skipInitialRefresh
          initialAccessToken={validJwt}
          initialUser={{
            id: '6710a1b2c3d4e5f6a7b8c9d0',
            displayName: 'Initial User',
            username: 'initialuser',
            avatarUrl: null,
            creditBalance: 1,
            referralCode: 'INIT1234',
          }}
        >
          <EmailConsumer />
        </AuthenticationProvider>
      );

      expect(screen.getByTestId('user-email').textContent).toBe('initial.jwt@example.com');
    });
  });

  describe('Optimistic hydration & silent refresh', () => {
    const cachedUser = {
      id: '6710a1b2c3d4e5f6a7b8c9d0',
      displayName: 'Cached User',
      username: 'cacheduser',
      avatarUrl: null,
      creditBalance: 10,
      referralCode: 'CACHE123',
    };

    it('should immediately hydrate user from storage and keep isLogged true while refresh is pending', async () => {
      httpService.saveUserStorage(cachedUser);

      let resolveRefresh: (token: string) => void = () => {};
      vi.spyOn(httpService, 'refreshAccessToken').mockReturnValue(
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
      );
      vi.spyOn(httpService, 'get').mockResolvedValue({
        data: { ...cachedUser, creditBalance: 12 },
      } as any);

      const HydrationConsumer = () => {
        const { isLogged, loading, user, accessToken } = useAuth();
        return (
          <div>
            <div data-testid="is-logged">{String(isLogged)}</div>
            <div data-testid="loading">{String(loading)}</div>
            <div data-testid="user-name">{user?.displayName || 'null'}</div>
            <div data-testid="access-token">{accessToken || 'null'}</div>
          </div>
        );
      };

      render(
        <AuthenticationProvider>
          <HydrationConsumer />
        </AuthenticationProvider>
      );

      // Immediately hydrated before refresh promise resolves
      expect(screen.getByTestId('loading').textContent).toBe('true');
      expect(screen.getByTestId('is-logged').textContent).toBe('true');
      expect(screen.getByTestId('user-name').textContent).toBe('Cached User');
      expect(screen.getByTestId('access-token').textContent).toBe('null');

      // Resolve refresh successfully
      await act(async () => {
        resolveRefresh('fresh-token');
      });

      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('is-logged').textContent).toBe('true');
      expect(screen.getByTestId('access-token').textContent).toBe('fresh-token');
      expect(httpService.getUserStorage()?.creditBalance).toBe(12);
    });

    it('should clear user, storage, and set isLogged to false when silent refresh fails', async () => {
      httpService.saveUserStorage(cachedUser);

      let rejectRefresh: (reason?: any) => void = () => {};
      vi.spyOn(httpService, 'refreshAccessToken').mockReturnValue(
        new Promise((_, reject) => {
          rejectRefresh = reject;
        })
      );

      const HydrationConsumer = () => {
        const { isLogged, loading, user } = useAuth();
        return (
          <div>
            <div data-testid="is-logged">{String(isLogged)}</div>
            <div data-testid="loading">{String(loading)}</div>
            <div data-testid="user-name">{user?.displayName || 'null'}</div>
          </div>
        );
      };

      render(
        <AuthenticationProvider>
          <HydrationConsumer />
        </AuthenticationProvider>
      );

      // Initially optimistic
      expect(screen.getByTestId('loading').textContent).toBe('true');
      expect(screen.getByTestId('is-logged').textContent).toBe('true');
      expect(screen.getByTestId('user-name').textContent).toBe('Cached User');

      // Reject refresh (e.g. 401 Unauthorized / expired cookie)
      await act(async () => {
        rejectRefresh(new Error('Unauthorized'));
      });

      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('is-logged').textContent).toBe('false');
      expect(screen.getByTestId('user-name').textContent).toBe('null');
      expect(httpService.getUserStorage()).toBeNull();
    });
  });

  describe('session restore on load', () => {
    const me = {
      id: '6710a1b2c3d4e5f6a7b8c9d0',
      displayName: 'Khôi Phục',
      username: null,
      email: 'restore@example.com',
      avatarUrl: null,
      creditBalance: 7,
      referralCode: 'K7QX4MZP',
      referralLink: 'http://localhost:5173/r/K7QX4MZP',
      hasPassword: false,
      providers: ['GOOGLE'],
      referral: { canEnterCode: true, enteredCode: null },
    };

    const LoadingProbe = () => {
      const { loading } = useAuth();
      return <div data-testid="loading">{String(loading)}</div>;
    };

    it('logs in from the refresh cookie and loads the profile from GET /me', async () => {
      const refresh = vi.spyOn(httpService, 'refreshAccessToken').mockResolvedValue('restored-token');
      const get = vi.spyOn(httpService, 'get').mockResolvedValue({ data: me } as any);

      render(
        <AuthenticationProvider>
          <TestConsumer />
          <LoadingProbe />
        </AuthenticationProvider>
      );

      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith('/api/v1/me');
      expect(screen.getByTestId('is-logged').textContent).toBe('true');
      expect(screen.getByTestId('user-name').textContent).toBe('Khôi Phục');
      expect(screen.getByTestId('user-credits').textContent).toBe('7');
      expect(screen.getByTestId('access-token').textContent).toBe('restored-token');
    });

    it('stays logged out when there is no valid refresh cookie', async () => {
      vi.spyOn(httpService, 'refreshAccessToken').mockRejectedValue(new Error('401'));
      const get = vi.spyOn(httpService, 'get');

      render(
        <AuthenticationProvider>
          <TestConsumer />
          <LoadingProbe />
        </AuthenticationProvider>
      );

      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
      expect(get).not.toHaveBeenCalled();
      expect(screen.getByTestId('is-logged').textContent).toBe('false');
    });

    it('clears the session when httpService reports it expired', async () => {
      render(
        <AuthenticationProvider skipInitialRefresh>
          <TestConsumer />
        </AuthenticationProvider>
      );
      await act(async () => {
        screen.getByText('Set Session').click();
      });
      expect(screen.getByTestId('is-logged').textContent).toBe('true');

      // Simulate a 401 UNAUTHENTICATED seen by the response interceptor
      const handlers = (httpService as unknown as { handlers: { onSessionExpired?: () => void } }).handlers;
      await act(async () => {
        handlers.onSessionExpired?.();
      });

      expect(screen.getByTestId('is-logged').textContent).toBe('false');
      expect(httpService.getInMemoryToken()).toBeNull();
    });
  });

  describe('PrivateRoute', () => {
    const renderProtected = () =>
      render(
        <AuthenticationProvider>
          <MemoryRouter initialEntries={['/account']}>
            <Routes>
              <Route path="/login" element={<div>login page</div>} />
              <Route
                path="/account"
                element={
                  <PrivateRoute>
                    <div>account page</div>
                  </PrivateRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthenticationProvider>
      );

    it('waits for the session restore instead of redirecting to /login', async () => {
      let finishRefresh!: (token: string) => void;
      vi.spyOn(httpService, 'refreshAccessToken').mockReturnValue(
        new Promise((resolve) => {
          finishRefresh = resolve;
        })
      );
      vi.spyOn(httpService, 'get').mockResolvedValue({ data: { id: 'u1', displayName: 'A' } } as any);

      renderProtected();
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByText('login page')).toBeNull();

      await act(async () => finishRefresh('restored-token'));
      expect(await screen.findByText('account page')).toBeInTheDocument();
    });

    it('redirects to /login once the restore fails', async () => {
      vi.spyOn(httpService, 'refreshAccessToken').mockRejectedValue(new Error('401'));

      renderProtected();
      expect(await screen.findByText('login page')).toBeInTheDocument();
    });
  });
});
