import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VerifyEmailPage from './index';
import authService from '@/services/authService';
import { AuthenticationProvider, useAuth } from '@/providers/AuthenticationProvider';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

const AuthInspector = () => {
  const { accessToken, user } = useAuth();
  return (
    <div data-testid="auth-state">
      <span data-testid="stored-token">{accessToken || 'none'}</span>
      <span data-testid="stored-user">{user?.displayName || 'none'}</span>
    </div>
  );
};

describe('VerifyEmailPage (Stitch Screen 1d106024adaa426eadcacab751819351)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedNavigate.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderComponent = (initialQuery = '') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/verify-email${initialQuery}`]}>
          <AuthenticationProvider skipInitialRefresh>
            <VerifyEmailPage />
            <AuthInspector />
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should clean token from browser URL bar upon mount (TC-030)', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    vi.spyOn(authService, 'postVerifyEmail').mockResolvedValue({
      accessToken: 'sample-jwt',
      expiresIn: 900,
      isNewUser: true,
      user: {
        id: '6710a1b2c3d4e5f6a7b8c9d0',
        displayName: 'Nguyễn Văn A',
        username: 'nguyenvana',
        avatarUrl: null,
        creditBalance: 3,
        referralCode: 'K7QX4MZP',
      },
    });

    await act(async () => {
      renderComponent('?token=VALID_TOKEN_123');
    });

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(
        {},
        expect.any(String),
        expect.any(String)
      );
    });
  });

  it('should show success state with 3 credits and redirect to /referral/enter (TC-015, TC-030)', async () => {
    vi.spyOn(authService, 'postVerifyEmail').mockResolvedValue({
      accessToken: 'valid-jwt-token-123',
      expiresIn: 900,
      isNewUser: true,
      user: {
        id: '6710a1b2c3d4e5f6a7b8c9d0',
        displayName: 'Nguyễn Văn A',
        username: 'nguyenvana',
        avatarUrl: null,
        creditBalance: 3,
        referralCode: 'K7QX4MZP',
      },
    });

    renderComponent('?token=VALID_TOKEN_123');

    // Wait for success screen
    await waitFor(() => {
      expect(screen.getByTestId('verify-success')).toBeInTheDocument();
    });

    // Content matching Stitch Screen 1d106024...
    expect(screen.getByText('Email đã được xác thực')).toBeInTheDocument();
    expect(
      screen.getByText(/Tài khoản của bạn đã sẵn sàng\. Bạn đã nhận/)
    ).toBeInTheDocument();
    expect(screen.getByText('3 credits')).toBeInTheDocument();
    expect(screen.getByText(/Tự động chuyển tiếp sau/)).toBeInTheDocument();

    // Verify token stored in-memory
    expect(screen.getByTestId('stored-token')).toHaveTextContent('valid-jwt-token-123');
    expect(screen.getByTestId('stored-user')).toHaveTextContent('Nguyễn Văn A');

    // Click "Bỏ qua chờ đợi" redirects to /referral/enter
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua chờ đợi' }));
    expect(mockedNavigate).toHaveBeenCalledWith('/referral/enter');
  });

  it('should show 4 credits celebration and redirect to /scan for referral signups (TC-019, TC-031)', async () => {
    vi.spyOn(authService, 'postVerifyEmail').mockResolvedValue({
      accessToken: 'valid-jwt-referral',
      expiresIn: 900,
      isNewUser: true,
      user: {
        id: '6710a1b2c3d4e5f6a7b8c9d1',
        displayName: 'Vip Referee',
        username: 'vipreferee',
        avatarUrl: null,
        creditBalance: 4,
        referralCode: 'VIPREF88',
      },
    });

    renderComponent('?token=REFERRAL_TOKEN_999');

    await waitFor(() => {
      expect(screen.getByTestId('verify-success')).toBeInTheDocument();
    });

    // Subtitle displays 4 credits bonus message
    expect(
      screen.getByText(/Chúc mừng! Bạn đã nhận/i)
    ).toBeInTheDocument();
    expect(screen.getByText('4 credits')).toBeInTheDocument();

    // Clicking "Bỏ qua chờ đợi" redirects directly to /scan
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua chờ đợi' }));
    expect(mockedNavigate).toHaveBeenCalledWith('/scan');
  });

  it('should display error card with resend form on invalid token (TC-016, TC-033)', async () => {
    vi.spyOn(authService, 'postVerifyEmail').mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: {
            code: 'VERIFICATION_TOKEN_INVALID',
            message: 'Liên kết xác minh không hợp lệ hoặc đã hết hạn (quá 24 giờ).',
          },
        },
      },
    });
    vi.spyOn(authService, 'postResendVerification').mockResolvedValue(undefined);

    renderComponent('?token=EXPIRED_OR_INVALID_TOKEN');

    // Wait for error card
    await waitFor(() => {
      expect(screen.getByTestId('verify-error')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Liên kết xác minh không hợp lệ hoặc đã hết hạn (quá 24 giờ).')
    ).toBeInTheDocument();

    // Has back to login link
    expect(screen.getByRole('link', { name: 'Quay lại Đăng nhập' })).toHaveAttribute(
      'href',
      '/login'
    );

    // Resend inline form test
    const emailInput = screen.getByPlaceholderText('minhanh@example.com');
    expect(emailInput).toHaveAttribute('aria-label', 'Email nhận lại link xác minh');
    fireEvent.change(emailInput, { target: { value: 'vana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại link xác minh' }));

    await waitFor(() => {
      expect(authService.postResendVerification).toHaveBeenCalledWith({
        email: 'vana@example.com',
      });
      expect(
        screen.getByText('Nếu email tồn tại, link xác minh mới đã được gửi.')
      ).toBeInTheDocument();
    });
  });

  it('should forward claimToken, show 2 credits celebration banner, and redirect to claimed reading (US-GUEST-001)', async () => {
    sessionStorage.setItem('ps_claim_token', 'claim-uuid-456');
    const postVerifySpy = vi.spyOn(authService, 'postVerifyEmail').mockResolvedValue({
      accessToken: 'claimed-jwt-token',
      expiresIn: 900,
      isNewUser: true,
      user: {
        id: '6710a1b2c3d4e5f6a7b8c9d0',
        displayName: 'Guest Claimer',
        username: 'guestclaimer',
        avatarUrl: null,
        creditBalance: 2,
        referralCode: 'CLAIMED1',
      },
      claimedReadingId: '67139f7e-c885-4463-a62a-3a5e1fb83001',
    });

    renderComponent('?token=VERIFY_TOKEN_777');

    await waitFor(() => {
      expect(postVerifySpy).toHaveBeenCalledWith({
        token: 'VERIFY_TOKEN_777',
        claimToken: 'claim-uuid-456',
      });
      expect(screen.getByTestId('claim-success-celebration')).toBeInTheDocument();
      expect(screen.getByText('2 credits')).toBeInTheDocument();
      expect(
        screen.getByText(/Tự động chuyển tiếp đến bài đọc sau/)
      ).toBeInTheDocument();
    });

    // Verify storage cleared
    expect(sessionStorage.getItem('ps_claim_token')).toBeNull();

    // Click "Bỏ qua chờ đợi" redirects to /readings/:id
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua chờ đợi' }));
    expect(mockedNavigate).toHaveBeenCalledWith('/readings/67139f7e-c885-4463-a62a-3a5e1fb83001');
  });
});
