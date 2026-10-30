import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ResetPassword from "./index";
import authService from "@/services/authService";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";

describe("ResetPassword Page", () => {
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

  const renderComponent = (
    initialEntries = ["/reset-password?token=valid-test-token"],
    isLoggedIn = false
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthenticationProvider
            skipInitialRefresh
            initialAccessToken={isLoggedIn ? "mock-access-token" : null}
            initialUser={isLoggedIn ? ({ id: "u-1", displayName: "Tester" } as any) : null}
          >
            <Routes>
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<div>Homepage Content</div>} />
              <Route path="/login" element={<div>Login Page Redirected</div>} />
            </Routes>
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render ResetPassword layout, headings, inputs, and submit button", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: "Đặt lại mật khẩu" })).toBeInTheDocument();
    expect(screen.getByText("Chọn mật khẩu mới cho tài khoản của bạn.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Mật khẩu mới/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Xác nhận mật khẩu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đặt lại mật khẩu" })).toBeInTheDocument();
  });

  it("should toggle password visibility on toggle button click", () => {
    renderComponent();

    const passwordInput = screen.getByLabelText(/Mật khẩu mới/) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggleButtons = screen.getAllByRole("button", { name: "Hiện" });
    fireEvent.click(toggleButtons[0]);
    expect(passwordInput.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Ẩn" }));
    expect(passwordInput.type).toBe("password");
  });

  it("should show validation error when passwords do not match", async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText(/Mật khẩu mới/), {
      target: { value: "StrongPass123" },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), {
      target: { value: "DifferentPass123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));

    await waitFor(() => {
      expect(screen.getByText("Mật khẩu xác nhận không khớp")).toBeInTheDocument();
    });
  });

  it("should show validation error when new password is too short", async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText(/Mật khẩu mới/), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), {
      target: { value: "123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));

    await waitFor(() => {
      expect(screen.getByText("Mật khẩu mới phải có ít nhất 8 ký tự")).toBeInTheDocument();
    });
  });

  it("should show warning alert when token is missing from URL query", () => {
    renderComponent(["/reset-password"]);

    expect(
      screen.getByText(/Không tìm thấy mã xác thực trong đường dẫn/i)
    ).toBeInTheDocument();
  });

  it("should submit new password with token, call API, and redirect to /login?reset=1", async () => {
    const postResetSpy = vi.spyOn(authService, "postResetPassword").mockResolvedValue(undefined);

    renderComponent(["/reset-password?token=my-secret-token-123"]);

    fireEvent.change(screen.getByLabelText(/Mật khẩu mới/), {
      target: { value: "BrandNewPass888" },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), {
      target: { value: "BrandNewPass888" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));

    await waitFor(() => {
      expect(postResetSpy).toHaveBeenCalledWith({
        token: "my-secret-token-123",
        newPassword: "BrandNewPass888",
      });
      expect(screen.getByText("Login Page Redirected")).toBeInTheDocument();
    });
  });

  it("should display error message when server responds with RESET_TOKEN_INVALID", async () => {
    vi.spyOn(authService, "postResetPassword").mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: {
            code: "RESET_TOKEN_INVALID",
            message: "Link đặt lại mật khẩu sai, hết hạn hoặc đã dùng",
          },
        },
      },
    });

    renderComponent(["/reset-password?token=expired-token"]);

    fireEvent.change(screen.getByLabelText(/Mật khẩu mới/), {
      target: { value: "BrandNewPass888" },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), {
      target: { value: "BrandNewPass888" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));

    await waitFor(() => {
      expect(
        screen.getByText("Link đặt lại mật khẩu sai, hết hạn hoặc đã dùng")
      ).toBeInTheDocument();
    });
  });

  it("should let a logged-in user (setting a first password) use the link, then log them out locally", async () => {
    vi.spyOn(authService, "postResetPassword").mockResolvedValue(undefined);
    const logoutSpy = vi.spyOn(authService, "postLogout").mockResolvedValue(undefined);

    renderComponent(["/reset-password?token=set-first-password"], true);

    expect(screen.getByRole("heading", { name: "Đặt lại mật khẩu" })).toBeInTheDocument();
    expect(screen.queryByText("Homepage Content")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Mật khẩu mới/), {
      target: { value: "FirstPassword888" },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), {
      target: { value: "FirstPassword888" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));

    // The server already ended every session, so the stale local one is dropped too
    expect(await screen.findByText("Login Page Redirected")).toBeInTheDocument();
    expect(logoutSpy).toHaveBeenCalled();
  });
});
