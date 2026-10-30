import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Wallet from "./index";
import httpService from "@/services/httpService";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";
import { CreditTransactionType } from "@palmsight/shared";

describe("Wallet Page", () => {
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

  const mockUser = {
    id: "6710a1b2c3d4e5f6a7b8c9d0",
    displayName: "Nguyễn Văn A",
    username: "nguyenvana",
    email: "a@example.com",
    avatarUrl: null,
    creditBalance: 4,
    referralCode: "K7QX4MZP",
    referralLink: "https://palmsight.app/r/K7QX4MZP",
    hasPassword: true,
    providers: [],
    referral: {
      canEnterCode: true,
      enteredCode: null,
    },
  };

  const mockTransactions = [
    {
      id: "tx-1",
      type: CreditTransactionType.SIGNUP_BONUS,
      amount: 3,
      balanceAfter: 3,
      createdAt: "2026-10-10T07:00:00Z",
    },
    {
      id: "tx-2",
      type: CreditTransactionType.REFERRAL_BONUS,
      amount: 2,
      balanceAfter: 5,
      createdAt: "2026-10-12T02:10:00Z",
    },
    {
      id: "tx-3",
      type: CreditTransactionType.REFEREE_BONUS,
      amount: 1,
      balanceAfter: 6,
      createdAt: "2026-10-13T09:00:00Z",
    },
    {
      id: "tx-4",
      type: CreditTransactionType.READING_SPEND,
      amount: -1,
      balanceAfter: 5,
      readingId: "rd-1",
      createdAt: "2026-10-14T08:31:02Z",
    },
    {
      id: "tx-5",
      type: CreditTransactionType.READING_REFUND,
      amount: 1,
      balanceAfter: 6,
      readingId: "rd-2",
      createdAt: "2026-10-14T08:35:00Z",
    },
    {
      id: "tx-6",
      type: CreditTransactionType.ADMIN_ADJUST,
      amount: 2,
      balanceAfter: 8,
      note: "Bù sự cố mạng",
      createdAt: "2026-10-15T10:00:00Z",
    },
  ];

  const renderComponent = (items = mockTransactions, userOverride = {}) => {
    vi.spyOn(httpService, "get").mockResolvedValue({
      data: {
        items,
        nextCursor: null,
      },
    } as any);

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/wallet"]}>
          <AuthenticationProvider
            skipInitialRefresh
            initialUser={{ ...mockUser, ...userOverride }}
          >
            <Wallet />
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render large terminal-style balance and invitation link", async () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: "Ví credits" })).toBeInTheDocument();
    expect(screen.getByTestId("wallet-balance-large")).toHaveTextContent("4 credits");
    expect(screen.getByText("Credits không hết hạn. Mỗi lần xem bói tiêu thụ 1 credit.")).toBeInTheDocument();

    const inviteLink = screen.getByRole("link", {
      name: /Mời bạn bè nhận thêm credits/i,
    });
    expect(inviteLink).toHaveAttribute("href", "/referral");
  });

  it("should display 'Nhập mã giới thiệu (+1)' when canEnterCode is true", async () => {
    renderComponent(mockTransactions, {
      referral: { canEnterCode: true, enteredCode: null },
    });

    const enterRefLink = screen.getByRole("link", {
      name: /Nhập mã giới thiệu \(\+1\)/i,
    });
    expect(enterRefLink).toHaveAttribute("href", "/referral/enter");
  });

  it("should list transactions with correct Vietnamese labels and amounts", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Quà đăng ký")).toBeInTheDocument();
      expect(screen.getByText("Thưởng giới thiệu")).toBeInTheDocument();
      expect(screen.getByText("Thưởng nhập mã")).toBeInTheDocument();
      expect(screen.getByText("Xem bói")).toBeInTheDocument();
      expect(screen.getByText("Hoàn credit")).toBeInTheDocument();
      expect(screen.getByText("Điều chỉnh (Bù sự cố mạng)")).toBeInTheDocument();

      // Check amounts
      expect(screen.getByText("+3")).toBeInTheDocument();
      expect(screen.getAllByText("+2").length).toBe(2);
      expect(screen.getAllByText("+1").length).toBe(2);
      expect(screen.getByText("-1")).toBeInTheDocument();
    });
  });

  it("should show empty state message when there are no transactions", async () => {
    renderComponent([]);

    await waitFor(() => {
      expect(screen.getByTestId("empty-transactions")).toHaveTextContent(
        "Chưa có giao dịch credits nào."
      );
    });
  });
});
