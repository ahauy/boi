import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Account from "./index";
import httpService from "@/services/httpService";
import authService from "@/services/authService";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";
import { AuthProvider } from "@palmsight/shared";

describe("Account Page", () => {
  let queryClient: QueryClient;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;
  let clipboardSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    clipboardSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardSpy },
      writable: true,
      configurable: true,
    });

    window.location.hash = "";

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const mockUserBase = {
    id: "6710a1b2c3d4e5f6a7b8c9d0",
    displayName: "Nguyễn Văn A",
    username: "nguyenvana",
    email: "a@example.com",
    avatarUrl: null,
    creditBalance: 4,
    referralCode: "K7QX4MZP",
    referralLink: "https://palmsight.app/r/K7QX4MZP",
    hasPassword: true,
    providers: [AuthProvider.GOOGLE],
    referral: {
      canEnterCode: true,
      enteredCode: null,
    },
  };

  // Resolves once GET /me has answered and the sections are on screen
  const renderComponent = async (userOverride = {}) => {
    const user = { ...mockUserBase, ...userOverride };
    vi.spyOn(httpService, "get").mockResolvedValue({ data: user } as any);

    const view = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/account"]}>
          <AuthenticationProvider skipInitialRefresh initialUser={user}>
            <Account />
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await screen.findByTestId("account-id-display");
    return view;
  };

  describe("Sub-menu navigation & anchors", () => {
    it("should render 5 internal anchor links with correct href attributes", async () => {
      await renderComponent();

      const navHoSo = screen.getByTestId("sub-nav-ho-so");
      const navBaoMat = screen.getByTestId("sub-nav-bao-mat");
      const navNhapMa = screen.getByTestId("sub-nav-nhap-ma");
      const navViCredits = screen.getByTestId("sub-nav-vi-credits");
      const navGioiThieu = screen.getByTestId("sub-nav-gioi-thieu");

      expect(navHoSo).toHaveAttribute("href", "#ho-so");
      expect(navBaoMat).toHaveAttribute("href", "#bao-mat");
      expect(navNhapMa).toHaveAttribute("href", "#nhap-ma");
      expect(navViCredits).toHaveAttribute("href", "#vi-credits");
      expect(navGioiThieu).toHaveAttribute("href", "#gioi-thieu");

      // Check default active state
      expect(navHoSo).toHaveClass("font-bold", "border-ink");
    });

    it("should smoothly scroll into view and switch active state on clicking a sub-menu item", async () => {
      await renderComponent();

      const navNhapMa = screen.getByTestId("sub-nav-nhap-ma");
      fireEvent.click(navNhapMa);

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
      expect(navNhapMa).toHaveClass("font-bold", "border-ink");

      const navViCredits = screen.getByTestId("sub-nav-vi-credits");
      fireEvent.click(navViCredits);

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
      expect(navViCredits).toHaveClass("font-bold", "border-ink");
      expect(navNhapMa).not.toHaveClass("border-ink");
    });
  });

  describe("Hồ sơ Section (#ho-so)", () => {
    it("should render profile info, username, email, and providers", async () => {
      await renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
        expect(screen.getByText("@nguyenvana")).toBeInTheDocument();
        expect(screen.getByText("a@example.com")).toBeInTheDocument();
        expect(screen.getByText("[+] Đã xác thực")).toBeInTheDocument();
        expect(
          screen.getByText("Đăng nhập bằng: Mật khẩu · Google")
        ).toBeInTheDocument();
      });
    });

    it("should display Account ID (MongoDB hex 24 chars) with copy button", async () => {
      await renderComponent();

      const idDisplay = screen.getByTestId("account-id-display");
      expect(idDisplay).toHaveTextContent("6710a1b2c3d4e5f6a7b8c9d0");

      const copyBtn = screen.getByRole("button", { name: "Sao chép" });
      fireEvent.click(copyBtn);

      expect(clipboardSpy).toHaveBeenCalledWith("6710a1b2c3d4e5f6a7b8c9d0");
      await waitFor(() => {
        expect(screen.getByText("Đã chép!")).toBeInTheDocument();
      });
    });

    it("should have link to /data-deletion and NO in-app self-delete button per ADR-0009", async () => {
      await renderComponent();

      const dataDeletionLinks = screen.getAllByRole("link", {
        name: /xoá dữ liệu/i,
      });
      expect(dataDeletionLinks.length).toBeGreaterThan(0);
      expect(dataDeletionLinks[0]).toHaveAttribute("href", "/data-deletion");

      expect(
        screen.queryByRole("button", { name: /^Xoá tài khoản$/i })
      ).not.toBeInTheDocument();
    });

    it("should call logout when clicking 'Đăng xuất'", async () => {
      const logoutSpy = vi.spyOn(authService, "postLogout").mockResolvedValue();

      await renderComponent();

      const logoutBtn = screen.getByRole("button", { name: "Đăng xuất" });
      fireEvent.click(logoutBtn);

      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  describe("Bảo mật Section (#bao-mat)", () => {
    it("should display 'Đổi mật khẩu' button linking to /change-password when hasPassword is true", async () => {
      await renderComponent({ hasPassword: true });

      const changePwLink = screen.getByRole("link", { name: "Đổi mật khẩu" });
      expect(changePwLink).toHaveAttribute("href", "/change-password");
    });

    it("should email a set-password link to a user without password when clicking 'Đặt mật khẩu'", async () => {
      const forgotSpy = vi.spyOn(authService, "postForgotPassword").mockResolvedValue(undefined);
      await renderComponent({ hasPassword: false, email: "google.only@example.com" });

      expect(screen.queryByRole("link", { name: "Đổi mật khẩu" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Đặt mật khẩu" }));

      await waitFor(() => {
        expect(forgotSpy).toHaveBeenCalledWith({ email: "google.only@example.com" });
        expect(screen.getByRole("status")).toHaveTextContent(
          "Đã gửi link đặt mật khẩu tới google.only@example.com"
        );
      });
      expect(screen.queryByRole("button", { name: "Đặt mật khẩu" })).not.toBeInTheDocument();
    });

    it("should show the server message when sending the set-password link fails", async () => {
      vi.spyOn(authService, "postForgotPassword").mockRejectedValue({
        response: {
          status: 429,
          data: { error: { code: "RATE_LIMITED", message: "Bạn đã gửi quá số lần cho phép." } },
        },
      });
      await renderComponent({ hasPassword: false });

      fireEvent.click(screen.getByRole("button", { name: "Đặt mật khẩu" }));

      expect(await screen.findByText("Bạn đã gửi quá số lần cho phép.")).toBeInTheDocument();
    });

    it("should explain that a password cannot be set when the account has no email", async () => {
      await renderComponent({ hasPassword: false, email: null, providers: [AuthProvider.FACEBOOK] });

      expect(screen.queryByRole("button", { name: "Đặt mật khẩu" })).not.toBeInTheDocument();
      expect(
        screen.getByText("Tài khoản chưa có email nên chưa thể đặt mật khẩu.")
      ).toBeInTheDocument();
    });
  });

  describe("Nhập mã giới thiệu Section (#nhap-ma)", () => {
    it("should render enter referral form when canEnterCode is true", async () => {
      await renderComponent({ referral: { canEnterCode: true, enteredCode: null } });

      expect(screen.getByTestId("enter-referral-form")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Xác nhận mã/i })
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("K7QX4MZP")
      ).toBeInTheDocument();
    });

    it("should submit referral code, update balance, and display success alert", async () => {
      const user = userEvent.setup();
      const postSpy = vi.spyOn(httpService, "post").mockResolvedValue({
        data: {
          accepted: true,
          referrer: { displayName: "Trần B" },
          creditsEarned: 1,
          creditBalance: 5,
        },
      } as any);

      await renderComponent({
        creditBalance: 4,
        referral: { canEnterCode: true, enteredCode: null },
      });

      const input = screen.getByPlaceholderText("K7QX4MZP");
      await user.type(input, "abcdef23");

      expect(input).toHaveValue("ABCDEF23");

      const submitBtn = screen.getByRole("button", { name: /Xác nhận mã/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith("/api/v1/me/referral", {
          code: "ABCDEF23",
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            "[✓] Đã ghi nhận mã của Trần B! Bạn được cộng 1 credit."
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText("[✓] Đã nhập mã giới thiệu: ABCDEF23")
        ).toBeInTheDocument();
      });
    });

    it("should handle REFERRAL_SELF error", async () => {
      const user = userEvent.setup();
      vi.spyOn(httpService, "post").mockRejectedValue({
        response: {
          status: 422,
          data: {
            error: {
              code: "REFERRAL_SELF",
              message: "Cannot enter self code",
            },
          },
        },
      });

      await renderComponent({ referral: { canEnterCode: true, enteredCode: null } });

      const input = screen.getByPlaceholderText("K7QX4MZP");
      await user.type(input, "K7QX4MZP");

      const submitBtn = screen.getByRole("button", { name: /Xác nhận mã/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Bạn không thể nhập mã của chính mình")
        ).toBeInTheDocument();
      });
    });

    it("should handle REFERRAL_CODE_NOT_FOUND error", async () => {
      const user = userEvent.setup();
      vi.spyOn(httpService, "post").mockRejectedValue({
        response: {
          status: 404,
          data: {
            error: {
              code: "REFERRAL_CODE_NOT_FOUND",
            },
          },
        },
      });

      await renderComponent({ referral: { canEnterCode: true, enteredCode: null } });

      const input = screen.getByPlaceholderText("K7QX4MZP");
      await user.type(input, "ZZZZZZZZ");

      const submitBtn = screen.getByRole("button", { name: /Xác nhận mã/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Mã không tồn tại, kiểm tra lại")
        ).toBeInTheDocument();
      });
    });

    it("should handle REFERRAL_ALREADY_USED error", async () => {
      const user = userEvent.setup();
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

      await renderComponent({ referral: { canEnterCode: true, enteredCode: null } });

      const input = screen.getByPlaceholderText("K7QX4MZP");
      await user.type(input, "K7QX4MZP");

      const submitBtn = screen.getByRole("button", { name: /Xác nhận mã/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Tài khoản đã nhập mã giới thiệu trước đó")
        ).toBeInTheDocument();
      });
    });

    it("should handle REFERRAL_CYCLE error", async () => {
      const user = userEvent.setup();
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

      await renderComponent({ referral: { canEnterCode: true, enteredCode: null } });

      const input = screen.getByPlaceholderText("K7QX4MZP");
      await user.type(input, "K7QX4MZP");

      const submitBtn = screen.getByRole("button", { name: /Xác nhận mã/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Không thể nhập mã của người bạn đã mời")
        ).toBeInTheDocument();
      });
    });

    it("should handle REFERRAL_NOT_ALLOWED error", async () => {
      const user = userEvent.setup();
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

      await renderComponent({ referral: { canEnterCode: true, enteredCode: null } });

      const input = screen.getByPlaceholderText("K7QX4MZP");
      await user.type(input, "K7QX4MZP");

      const submitBtn = screen.getByRole("button", { name: /Xác nhận mã/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Tài khoản không đủ điều kiện nhập mã")
        ).toBeInTheDocument();
      });
    });

    it("should display entered code banner when referral.enteredCode already exists", async () => {
      await renderComponent({
        referral: { canEnterCode: false, enteredCode: "K7QX4MZP" },
      });

      expect(
        screen.getByText("[✓] Đã nhập mã giới thiệu: K7QX4MZP")
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("enter-referral-form")
      ).not.toBeInTheDocument();
    });

    it("should display not eligible notice when canEnterCode is false and no enteredCode", async () => {
      await renderComponent({
        referral: { canEnterCode: false, enteredCode: null },
      });

      expect(screen.getByTestId("referral-not-eligible")).toHaveTextContent(
        "Tài khoản không đủ điều kiện nhập mã."
      );
      expect(
        screen.queryByTestId("enter-referral-form")
      ).not.toBeInTheDocument();
    });
  });

  describe("Ví credits Section (#vi-credits)", () => {
    it("should display credit balance, expiration note, and link to /wallet", async () => {
      await renderComponent({ creditBalance: 7 });

      const creditsDisplay = screen.getByTestId("account-credits-display");
      expect(creditsDisplay).toHaveTextContent("7 credits");

      expect(
        screen.getByText(/Credits không có hạn sử dụng/i)
      ).toBeInTheDocument();

      const walletLinks = screen.getAllByRole("link", { name: /Ví credits/i });
      expect(walletLinks.some((l) => l.getAttribute("href") === "/wallet")).toBe(
        true
      );
    });
  });

  describe("Giới thiệu Section (#gioi-thieu)", () => {
    it("should display referral code with copy button, share link, and sample message", async () => {
      await renderComponent({ referralCode: "K7QX4MZP" });

      const codeDisplay = screen.getByTestId("referral-code-display");
      expect(codeDisplay).toHaveTextContent("K7QX4MZP");

      const copyCodeBtn = screen.getByRole("button", { name: "Sao chép mã" });
      fireEvent.click(copyCodeBtn);
      expect(clipboardSpy).toHaveBeenCalledWith("K7QX4MZP");

      const linkDisplay = screen.getByTestId("referral-link-display");
      expect(linkDisplay).toHaveTextContent("/r/K7QX4MZP");

      const copyLinkBtn = screen.getByRole("button", {
        name: "Sao chép liên kết",
      });
      fireEvent.click(copyLinkBtn);
      expect(clipboardSpy).toHaveBeenCalledWith(
        expect.stringContaining("/r/K7QX4MZP")
      );

      const sampleText = screen.getByTestId("sample-share-text");
      expect(sampleText).toHaveTextContent("K7QX4MZP");

      const copyMsgBtn = screen.getByRole("button", {
        name: "Sao chép câu mời",
      });
      fireEvent.click(copyMsgBtn);
      expect(clipboardSpy).toHaveBeenCalledWith(
        expect.stringContaining("K7QX4MZP")
      );

      const referralDetailLink = screen.getByRole("link", {
        name: /Mời bạn bè nhận credit/i,
      });
      expect(referralDetailLink).toHaveAttribute("href", "/referral");
    });
  });

  describe("GET /me data", () => {
    it("should show the real /me profile instead of the summary kept from login", async () => {
      // Login responses carry no hasPassword: the page must not guess it
      const loginSummary = { ...mockUserBase, hasPassword: undefined as any, referral: undefined as any };
      vi.spyOn(httpService, "get").mockResolvedValue({
        data: { ...mockUserBase, hasPassword: false },
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/account"]}>
            <AuthenticationProvider skipInitialRefresh initialUser={loginSummary}>
              <Account />
            </AuthenticationProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(await screen.findByRole("button", { name: "Đặt mật khẩu" })).toBeInTheDocument();
      expect(httpService.get).toHaveBeenCalledWith("/api/v1/me");
    });

    it("should not call /me while there is no user in context", async () => {
      const getSpy = vi.spyOn(httpService, "get");

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/account"]}>
            <AuthenticationProvider skipInitialRefresh initialUser={null}>
              <Account />
            </AuthenticationProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // No user in context means nothing to fetch for yet
      expect(screen.getByText("Đang tải thông tin tài khoản...")).toBeInTheDocument();
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("should show an error with a retry button instead of made-up data when /me fails", async () => {
      const getSpy = vi
        .spyOn(httpService, "get")
        .mockRejectedValueOnce(new Error("Network Error"))
        .mockResolvedValueOnce({ data: mockUserBase } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/account"]}>
            <AuthenticationProvider skipInitialRefresh initialUser={mockUserBase}>
              <Account />
            </AuthenticationProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(await screen.findByText("Không tải được thông tin tài khoản.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

      expect(await screen.findByTestId("account-id-display")).toHaveTextContent(mockUserBase.id);
      expect(getSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Sub-menu navigation & bottom scroll interaction", () => {
    it("should maintain active state when clicking 'Giới thiệu' and ignore scroll overwrite during smooth scroll", async () => {
      await renderComponent();

      const navGioiThieu = screen.getByTestId("sub-nav-gioi-thieu");
      fireEvent.click(navGioiThieu);

      expect(navGioiThieu).toHaveClass("font-bold", "border-ink");
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });

      // Trigger scroll event immediately while manual scroll is active
      fireEvent.scroll(window, { target: { scrollY: 100 } });

      // 'gioi-thieu' should remain active
      expect(navGioiThieu).toHaveClass("font-bold", "border-ink");
    });

    it("should activate 'Giới thiệu' when scrolled to the bottom of the page", async () => {
      await renderComponent();

      // Simulate reaching bottom
      Object.defineProperty(window, "innerHeight", {
        value: 800,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "scrollY", {
        value: 1200,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "scrollHeight", {
        value: 2000,
        writable: true,
        configurable: true,
      });

      fireEvent.scroll(window);

      const navGioiThieu = screen.getByTestId("sub-nav-gioi-thieu");
      expect(navGioiThieu).toHaveClass("font-bold", "border-ink");
    });
  });
});

