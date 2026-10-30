import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReferralEnter from "./index";
import ReferralRedirect from "./ReferralRedirect";
import httpService from "@/services/httpService";
import * as toastHelper from "@/helpers/toast";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("ReferralEnter Page & ReferralRedirect", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    document.cookie = "ref_code=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderComponent = (initialRoute = "/referral/enter") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <AuthenticationProvider
            skipInitialRefresh
            initialUser={{
              id: "6710a1b2c3d4e5f6a7b8c9d0",
              displayName: "Test User",
              username: "testuser",
              creditBalance: 3,
              referralCode: "MYCODE88",
              avatarUrl: null,
            }}
          >
            <ReferralEnter />
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render page layout, descriptions, input, and buttons", () => {
    renderComponent();

    expect(
      screen.getByRole("heading", { name: "Nhập mã giới thiệu" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nếu có người mời bạn, nhập mã để họ nhận 2 credits/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Mã giới thiệu/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ qua" })).toBeInTheDocument();
  });

  it("should prefill code input from cookie ref_code", () => {
    document.cookie = "ref_code=K7QX4MZP; path=/;";
    renderComponent();

    const input = screen.getByLabelText(/Mã giới thiệu/i) as HTMLInputElement;
    expect(input.value).toBe("K7QX4MZP");
  });

  it("should prefill code input from search param", () => {
    renderComponent("/referral/enter?code=FRIEND88");

    const input = screen.getByLabelText(/Mã giới thiệu/i) as HTMLInputElement;
    expect(input.value).toBe("FRIEND88");
  });

  it("should navigate to /scan when clicking Bỏ qua", () => {
    renderComponent();

    const skipButton = screen.getByRole("button", { name: "Bỏ qua" });
    fireEvent.click(skipButton);

    expect(mockNavigate).toHaveBeenCalledWith("/scan");
  });

  it("should submit code successfully and update credit balance, show toast, and navigate to /scan", async () => {
    const showSuccessSpy = vi.spyOn(toastHelper, "showSuccess").mockImplementation(() => {});
    vi.spyOn(httpService, "post").mockResolvedValue({
      data: {
        accepted: true,
        referrer: { displayName: "Nguyễn A" },
        creditsEarned: 1,
        creditBalance: 4,
      },
    } as any);

    renderComponent();

    const input = screen.getByLabelText(/Mã giới thiệu/i);
    fireEvent.change(input, { target: { value: "K7QX4MZP" } });

    const submitBtn = screen.getByRole("button", { name: "Xác nhận" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(httpService.post).toHaveBeenCalledWith("/api/v1/me/referral", {
        code: "K7QX4MZP",
      });
      expect(showSuccessSpy).toHaveBeenCalledWith(
        "Đã ghi nhận mã của Nguyễn A. Bạn nhận được 1 credit!"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/scan");
    });
  });

  it("should handle error REFERRAL_CODE_NOT_FOUND", async () => {
    vi.spyOn(httpService, "post").mockRejectedValue({
      response: {
        status: 404,
        data: {
          error: {
            code: "REFERRAL_CODE_NOT_FOUND",
            message: "Mã giới thiệu không tồn tại",
          },
        },
      },
    });

    renderComponent();

    const input = screen.getByLabelText(/Mã giới thiệu/i);
    fireEvent.change(input, { target: { value: "ABCDEFGH" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => {
      expect(
        screen.getByText("Mã không tồn tại, kiểm tra lại")
      ).toBeInTheDocument();
    });
  });

  it("should handle error REFERRAL_SELF", async () => {
    vi.spyOn(httpService, "post").mockRejectedValue({
      response: {
        status: 422,
        data: {
          error: {
            code: "REFERRAL_SELF",
          },
        },
      },
    });

    renderComponent();

    const input = screen.getByLabelText(/Mã giới thiệu/i);
    fireEvent.change(input, { target: { value: "HJKMNP23" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => {
      expect(
        screen.getByText("Bạn không thể nhập mã của chính mình")
      ).toBeInTheDocument();
    });
  });

  it("should handle error REFERRAL_ALREADY_USED", async () => {
    vi.spyOn(httpService, "post").mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            code: "REFERRAL_ALREADY_USED",
          },
        },
      },
    });

    renderComponent();

    const input = screen.getByLabelText(/Mã giới thiệu/i);
    fireEvent.change(input, { target: { value: "Z2345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => {
      expect(
        screen.getByText("Tài khoản đã nhập mã giới thiệu trước đó")
      ).toBeInTheDocument();
    });
  });

  it("should handle error REFERRAL_CYCLE", async () => {
    vi.spyOn(httpService, "post").mockRejectedValue({
      response: {
        status: 422,
        data: {
          error: {
            code: "REFERRAL_CYCLE",
          },
        },
      },
    });

    renderComponent();

    const input = screen.getByLabelText(/Mã giới thiệu/i);
    fireEvent.change(input, { target: { value: "WXYZ2345" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => {
      expect(
        screen.getByText("Không thể nhập mã của người bạn đã mời")
      ).toBeInTheDocument();
    });
  });

  it("should handle error REFERRAL_NOT_ALLOWED", async () => {
    vi.spyOn(httpService, "post").mockRejectedValue({
      response: {
        status: 403,
        data: {
          error: {
            code: "REFERRAL_NOT_ALLOWED",
          },
        },
      },
    });

    renderComponent();

    const input = screen.getByLabelText(/Mã giới thiệu/i);
    fireEvent.change(input, { target: { value: "K7QX4MZP" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => {
      expect(
        screen.getByText("Tài khoản này không thể nhập mã giới thiệu.")
      ).toBeInTheDocument();
    });
  });

  it("ReferralRedirect should set ref_code cookie and navigate to /register", async () => {
    render(
      <MemoryRouter initialEntries={["/r/K7QX4MZP"]}>
        <Routes>
          <Route path="/r/:code" element={<ReferralRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    expect(document.cookie).toContain("ref_code=K7QX4MZP");
    expect(mockNavigate).toHaveBeenCalledWith("/register", { replace: true });
  });
});
