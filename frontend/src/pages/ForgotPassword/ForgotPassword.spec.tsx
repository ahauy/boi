import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ForgotPassword from "./index";
import authService from "@/services/authService";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";

describe("ForgotPassword Page", () => {
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

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/forgot-password"]}>
          <AuthenticationProvider skipInitialRefresh>
            <ForgotPassword />
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render ForgotPassword elements and submit", async () => {
    vi.spyOn(authService, "postForgotPassword").mockResolvedValue(undefined);

    renderComponent();

    expect(screen.getByRole("heading", { name: "Quên mật khẩu" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: "user@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

    await waitFor(() => {
      expect(authService.postForgotPassword).toHaveBeenCalledWith({
        email: "user@example.com",
      });
      expect(
        screen.getByText("Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi.")
      ).toBeInTheDocument();
    });
  });
});
