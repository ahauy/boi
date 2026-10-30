import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ChangePassword from "./index";
import httpService from "@/services/httpService";

describe("ChangePassword Page", () => {
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
        <MemoryRouter initialEntries={["/change-password"]}>
          <ChangePassword />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render ChangePassword form inputs and submit", async () => {
    vi.spyOn(httpService, "put").mockResolvedValue({ data: {} } as any);

    renderComponent();

    expect(screen.getByRole("heading", { name: "Đổi mật khẩu" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Mật khẩu hiện tại/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mật khẩu mới/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Xác nhận mật khẩu/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Mật khẩu hiện tại/), {
      target: { value: "OldPassword123" },
    });
    fireEvent.change(screen.getByLabelText(/Mật khẩu mới/), {
      target: { value: "NewPassword123" },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), {
      target: { value: "NewPassword123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

    await waitFor(() => {
      expect(httpService.put).toHaveBeenCalledWith("/api/v1/me/password", {
        currentPassword: "OldPassword123",
        newPassword: "NewPassword123",
      });
      expect(screen.getByText("Đổi mật khẩu thành công.")).toBeInTheDocument();
    });
  });

  const fillAndSubmit = (current: string, next: string) => {
    fireEvent.change(screen.getByLabelText(/Mật khẩu hiện tại/), { target: { value: current } });
    fireEvent.change(screen.getByLabelText(/Mật khẩu mới/), { target: { value: next } });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/), { target: { value: next } });
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
  };

  it("should show CURRENT_PASSWORD_INCORRECT under the current password field", async () => {
    vi.spyOn(httpService, "put").mockRejectedValue({
      response: {
        status: 400,
        data: { error: { code: "CURRENT_PASSWORD_INCORRECT", message: "Mật khẩu hiện tại không đúng." } },
      },
    });

    renderComponent();
    fillAndSubmit("WrongPassword1", "NewPassword123");

    expect(await screen.findByText("Mật khẩu hiện tại không đúng")).toBeInTheDocument();
    expect(screen.queryByText("Đổi mật khẩu thành công.")).not.toBeInTheDocument();
  });

  it("should show server VALIDATION_ERROR field messages under the matching field", async () => {
    vi.spyOn(httpService, "put").mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dữ liệu gửi lên không hợp lệ.",
            details: {
              fields: [{ field: "newPassword", message: "Mật khẩu không được trùng với username hoặc email" }],
            },
          },
        },
      },
    });

    renderComponent();
    fillAndSubmit("OldPassword123", "me@example.com");

    expect(
      await screen.findByText("Mật khẩu không được trùng với username hoặc email")
    ).toBeInTheDocument();
  });
});
