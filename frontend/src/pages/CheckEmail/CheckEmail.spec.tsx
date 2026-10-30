import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CheckEmailPage from './index';
import authService from '@/services/authService';

describe('CheckEmailPage (Stitch Screen e2ca007ff9be4c8eb496a3933785c6db)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderComponent = (initialState?: { email?: string }, initialQuery = '') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/register/check-email',
              search: initialQuery,
              state: initialState,
            },
          ]}
        >
          <CheckEmailPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should render Stitch layout, email notification sentence, 3 steps, and spam notice', () => {
    renderComponent({ email: 'tranvanb@example.com' });

    // Title
    expect(
      screen.getByRole('heading', { name: 'Kiểm tra hộp thư của bạn' })
    ).toBeInTheDocument();

    // Email sentence (TC-030)
    expect(screen.getByText(/Đã gửi link xác minh tới/)).toBeInTheDocument();
    expect(screen.getByTestId('user-email')).toHaveTextContent('tranvanb@example.com');
    expect(screen.getByText('Link có hiệu lực trong 24 giờ.')).toBeInTheDocument();

    // 3 steps
    expect(screen.getByText('Làm theo 3 bước')).toBeInTheDocument();
    expect(screen.getByText(/Mở email từ PalmSight/)).toBeInTheDocument();
    expect(screen.getByText(/Bấm vào link xác thực/)).toBeInTheDocument();
    expect(screen.getByText(/Quay lại để đăng nhập/)).toBeInTheDocument();

    // Spam callout
    expect(
      screen.getByText(/Không thấy email\? Kiểm tra thư mục spam\./)
    ).toBeInTheDocument();

    // "Dùng email khác" link
    const switchEmailLink = screen.getByRole('link', { name: 'Dùng email khác' });
    expect(switchEmailLink).toBeInTheDocument();
    expect(switchEmailLink).toHaveAttribute('href', '/register');
  });

  it('should trigger resend verification and start 60s cooldown timer with toast (TC-032)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(authService, 'postResendVerification').mockResolvedValue(undefined);

    renderComponent({ email: 'tranvanb@example.com' });

    const resendBtn = screen.getByRole('button', {
      name: 'Gửi lại email xác minh',
    });
    expect(resendBtn).toBeEnabled();

    // Click resend
    await act(async () => {
      fireEvent.click(resendBtn);
    });

    // API called with email
    expect(authService.postResendVerification).toHaveBeenCalledWith({
      email: 'tranvanb@example.com',
    });

    // Toast appears
    expect(screen.getByTestId('toast-success')).toHaveTextContent(
      'Đã gửi lại email xác minh thành công.'
    );

    // Button disabled and countdown active
    expect(resendBtn).toBeDisabled();
    expect(resendBtn.textContent).toMatch(/Gửi lại sau \(\d+s\)\.\.\./);

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(resendBtn.textContent).toContain('59s');

    // Button remains disabled
    expect(resendBtn).toBeDisabled();

    vi.useRealTimers();
  });

  it('should display error message when resend returns 429 rate limit', async () => {
    vi.spyOn(authService, 'postResendVerification').mockRejectedValue({
      response: {
        status: 429,
        data: {
          error: {
            code: 'RATE_LIMITED',
            message: 'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.',
          },
        },
      },
    });

    renderComponent({ email: 'spam@example.com' });

    const resendBtn = screen.getByRole('button', {
      name: 'Gửi lại email xác minh',
    });

    await act(async () => {
      fireEvent.click(resendBtn);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.'
      );
    });
  });

  it('should prevent false-success when email is empty and display an error alert', async () => {
    vi.spyOn(authService, 'postResendVerification');

    renderComponent({ email: '' });

    const resendBtn = screen.getByRole('button', {
      name: 'Gửi lại email xác minh',
    });

    await act(async () => {
      fireEvent.click(resendBtn);
    });

    // Verification API should not be called
    expect(authService.postResendVerification).not.toHaveBeenCalled();

    // False success toast should NOT be displayed
    expect(screen.queryByTestId('toast-success')).not.toBeInTheDocument();

    // Error alert banner should explain that email is missing
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Không tìm thấy địa chỉ email để gửi lại xác minh. Vui lòng quay lại trang đăng ký.'
    );
  });
});
