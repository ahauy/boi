import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterPage from './index';
import authService from '@/services/authService';
import { Toaster } from '@/components/ui/toaster';
import * as toastHelper from '@/helpers/toast';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe('RegisterPage (Stitch Screen 59bf8c4b91a04c18a0afbf3139812e0d)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedNavigate.mockReset();
    document.cookie = 'ref_code=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/register']}>
          <RegisterPage />
          <Toaster />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should render all Stitch layout elements, typography, and terminal markers', () => {
    renderComponent();

    // Display title & subtitle
    expect(screen.getByRole('heading', { name: 'Tạo tài khoản' })).toBeInTheDocument();
    expect(screen.getByText('Xác thực email để nhận 3 credits.')).toBeInTheDocument();

    // Value propositions with [+] terminal markers
    expect(screen.getByText('1 lần xem bói = 1 credit')).toBeInTheDocument();
    expect(screen.getByText('Chọn phương Tây, phương Đông hoặc Ấn Độ')).toBeInTheDocument();
    expect(screen.getByText('Xoá ảnh và dữ liệu bất cứ lúc nào')).toBeInTheDocument();

    // Form inputs and captions
    expect(screen.getByLabelText('Tên hiển thị')).toBeInTheDocument();
    expect(screen.getByLabelText('Tên đăng nhập')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
    expect(screen.getByLabelText('Xác nhận mật khẩu')).toBeInTheDocument();
    expect(screen.getByLabelText(/Mã giới thiệu/)).toBeInTheDocument();

    // Helper captions with [i]
    expect(
      screen.getByText(/3–20 ký tự: chữ thường không dấu, số và dấu gạch dưới\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Chúng tôi gửi link xác thực tới email này\./)
    ).toBeInTheDocument();

    // Submit button
    expect(
      screen.getByRole('button', { name: 'Tạo tài khoản' })
    ).toBeInTheDocument();
  });

  it('should prefill referralCode from cookie ref_code', () => {
    document.cookie = 'ref_code=K7QX4MZP; path=/;';
    renderComponent();

    const referralInput = screen.getByLabelText(/Mã giới thiệu/) as HTMLInputElement;
    expect(referralInput.value).toBe('K7QX4MZP');
  });

  it('should toggle password visibility between password and text', () => {
    renderComponent();

    const passwordInput = screen.getByLabelText('Mật khẩu') as HTMLInputElement;
    const toggleButtons = screen.getAllByRole('button', { name: 'Hiện' });
    const passwordToggle = toggleButtons[0];

    expect(passwordInput.type).toBe('password');
    fireEvent.click(passwordToggle);
    expect(passwordInput.type).toBe('text');
  });

  it('should show error when terms checkbox is not checked', async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Trần Văn B' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'tranvanb' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'tranvanb@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(
        screen.getByText('Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách riêng tư.')
      ).toBeInTheDocument();
    });
  });

  it('should show validation error when confirm password does not match', async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Trần Văn B' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'tranvanb' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'tranvanb@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'Khac_BaoMat' },
    });
    // Check terms
    fireEvent.click(screen.getByLabelText(/Tôi đồng ý với/));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(screen.getByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument();
    });
  });

  it('should submit registration successfully and navigate to /register/check-email (TC-030)', async () => {
    vi.spyOn(authService, 'postRegister').mockResolvedValue({
      email: 'tranvanb@example.com',
      verificationExpiresAt: '2026-10-16T08:30:00.000Z',
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Trần Văn B' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'tranvanb' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'tranvanb@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.click(screen.getByLabelText(/Tôi đồng ý với/));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(authService.postRegister).toHaveBeenCalledWith({
        displayName: 'Trần Văn B',
        username: 'tranvanb',
        email: 'tranvanb@example.com',
        password: 'BaoMat_987654',
      });
      expect(mockedNavigate).toHaveBeenCalledWith(
        '/register/check-email?email=tranvanb%40example.com',
        { state: { email: 'tranvanb@example.com' } }
      );
    });
  });

  it('should display inline error and toaster when server responds with 409 EMAIL_TAKEN (TC-034)', async () => {
    const showErrorSpy = vi.spyOn(toastHelper, 'showError');
    vi.spyOn(authService, 'postRegister').mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            code: 'EMAIL_TAKEN',
            message: 'Email này đã được sử dụng.',
          },
        },
      },
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Trần Văn B' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'tranvanb' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'existing@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.click(screen.getByLabelText(/Tôi đồng ý với/));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(showErrorSpy).toHaveBeenCalledWith('Email này đã được sử dụng.');
      expect(screen.getByTestId('error-email')).toHaveTextContent(
        'Email này đã được sử dụng.'
      );
      const errorElements = screen.getAllByText('Email này đã được sử dụng.');
      expect(errorElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should display toaster error when email exists via social login (Google/Facebook)', async () => {
    const showErrorSpy = vi.spyOn(toastHelper, 'showError');
    const oauthErrorMessage =
      'Email này đã được liên kết với tài khoản Google hoặc Facebook. Vui lòng đăng nhập.';
    vi.spyOn(authService, 'postRegister').mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            code: 'EMAIL_TAKEN',
            message: oauthErrorMessage,
          },
        },
      },
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Trần Văn B' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'tranvanb' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'socialuser@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.click(screen.getByLabelText(/Tôi đồng ý với/));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(showErrorSpy).toHaveBeenCalledWith(oauthErrorMessage);
      expect(screen.getByTestId('error-email')).toHaveTextContent(oauthErrorMessage);
      const errorElements = screen.getAllByText(oauthErrorMessage);
      expect(errorElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should display inline error when server responds with 409 USERNAME_TAKEN (TC-034)', async () => {
    vi.spyOn(authService, 'postRegister').mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            code: 'USERNAME_TAKEN',
            message: 'Tên người dùng đã được sử dụng.',
          },
        },
      },
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Trần Văn B' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'palmsight_pro' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user2@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.click(screen.getByLabelText(/Tôi đồng ý với/));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(screen.getByTestId('error-username')).toHaveTextContent(
        'Tên người dùng đã được sử dụng.'
      );
    });
  });

  it('should display alert banner and toaster when server responds with 429 RATE_LIMITED', async () => {
    const showErrorSpy = vi.spyOn(toastHelper, 'showError');
    vi.spyOn(authService, 'postRegister').mockRejectedValue({
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

    renderComponent();

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Trần Văn B' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'tranvanb' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'spam@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.click(screen.getByLabelText(/Tôi đồng ý với/));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(showErrorSpy).toHaveBeenCalledWith(
        'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.'
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.'
      );
    });
  });

  it('should call showError and display alert banner when server responds with 500 error', async () => {
    const showErrorSpy = vi.spyOn(toastHelper, 'showError');
    vi.spyOn(authService, 'postRegister').mockRejectedValue({
      response: {
        status: 500,
        data: {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.',
          },
        },
      },
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Trần Văn B' },
    });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {
      target: { value: 'tranvanb' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'tranvanb@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
      target: { value: 'BaoMat_987654' },
    });
    fireEvent.click(screen.getByLabelText(/Tôi đồng ý với/));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(showErrorSpy).toHaveBeenCalledWith(
        'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.'
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.'
      );
    });
  });

  it('should support ARIA accessibility attributes (aria-invalid and aria-describedby)', async () => {
    renderComponent();

    const usernameInput = screen.getByLabelText('Tên đăng nhập');
    expect(usernameInput).toHaveAttribute('aria-invalid', 'false');
    expect(usernameInput).toHaveAttribute('aria-describedby', 'username-hint');

    // Submit without accepting terms
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Tôi đồng ý với/)).toHaveAttribute('aria-invalid', 'true');
    });

    // Accept terms and submit with invalid username
    fireEvent.click(screen.getByLabelText(/Tôi đồng ý với/));
    fireEvent.change(usernameInput, { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
      expect(usernameInput).toHaveAttribute('aria-describedby', 'username-error');
    });
  });

  it('should extract claimToken from query and pass it in registration payload', async () => {
    const postRegisterSpy = vi.spyOn(authService, 'postRegister').mockResolvedValueOnce({
      email: 'guest@example.com',
      verificationExpiresAt: '2026-10-26T12:00:00Z',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/register?claimToken=e4b8a21f-82df-4db3-9824-7128cf4291f0']}>
          <RegisterPage />
          <Toaster />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('claim-token-banner')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Guest User' } });
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'guestuser' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'guest@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'ValidPassword123!' } });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), { target: { value: 'ValidPassword123!' } });
    fireEvent.click(screen.getByLabelText(/Tôi đồng ý với/));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await waitFor(() => {
      expect(postRegisterSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claimToken: 'e4b8a21f-82df-4db3-9824-7128cf4291f0',
        })
      );
      expect(mockedNavigate).toHaveBeenCalledWith(
        expect.stringContaining('claimToken=e4b8a21f-82df-4db3-9824-7128cf4291f0'),
        expect.anything()
      );
    });
  });
});
