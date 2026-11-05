import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Referral from "./index";
import httpService from "@/services/httpService";
import * as toastHelper from "@/helpers/toast";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";
import { ReferralStatus } from "@palmsight/shared";

describe("Referral Page", () => {
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

  const mockReferralData = {
    totalRewarded: 3,
    totalCreditsEarned: 7,
    items: [
      {
        displayName: "Lê C***",
        status: ReferralStatus.REWARDED,
        creditsEarned: 2,
        createdAt: "2026-10-12T02:10:00Z",
      },
      {
        displayName: "Phạm D***",
        status: ReferralStatus.CAPPED,
        creditsEarned: 0,
        createdAt: "2026-10-13T04:20:00Z",
      },
      {
        displayName: "Người dùng đã xoá",
        status: ReferralStatus.REWARDED,
        creditsEarned: 2,
        createdAt: "2026-10-08T06:00:00Z",
      },
      {
        displayName: "Vũ E***",
        status: ReferralStatus.REWARDED,
        creditsEarned: 3,
        createdAt: "2026-11-02T03:30:00Z",
      },
    ],
    nextCursor: null,
  };

  const renderComponent = (referralDataOverride = mockReferralData) => {
    vi.spyOn(httpService, "get").mockResolvedValue({
      data: referralDataOverride,
    } as any);

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/referral"]}>
          <AuthenticationProvider skipInitialRefresh initialUser={mockUser}>
            <Referral />
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render 8-char referral code and link", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: "Giới thiệu bạn bè" })).toBeInTheDocument();
    expect(screen.getByTestId("referral-code-display")).toHaveTextContent("K7QX4MZP");
    expect(screen.getByTestId("referral-link-display")).toHaveTextContent("/r/K7QX4MZP");
  });

  it("should display sample invitation message", () => {
    renderComponent();

    const sampleMessage = screen.getByTestId("sample-share-text");
    expect(sampleMessage).toHaveTextContent(
      "Nhập mã K7QX4MZP trên PalmSight: bạn được thêm 5 GEM xem bói miễn phí"
    );
  });

  it("should copy referral code to clipboard and show success notification", async () => {
    const clipboardSpy = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardSpy,
      },
    });
    const showSuccessSpy = vi.spyOn(toastHelper, "showSuccess").mockImplementation(() => {});

    renderComponent();

    const copyBtn = screen.getByRole("button", { name: "Sao chép mã" });
    fireEvent.click(copyBtn);

    expect(clipboardSpy).toHaveBeenCalledWith("K7QX4MZP");
    expect(showSuccessSpy).toHaveBeenCalledWith("Đã sao chép mã giới thiệu!");
    await waitFor(() => {
      expect(screen.getByText("Đã chép!")).toBeInTheDocument();
    });
  });

  it("should copy referral link to clipboard and show success notification", async () => {
    const clipboardSpy = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardSpy,
      },
    });
    const showSuccessSpy = vi.spyOn(toastHelper, "showSuccess").mockImplementation(() => {});

    renderComponent();

    const copyLinkBtn = screen.getByRole("button", { name: "Sao chép liên kết" });
    fireEvent.click(copyLinkBtn);

    expect(clipboardSpy).toHaveBeenCalled();
    expect(showSuccessSpy).toHaveBeenCalledWith("Đã sao chép liên kết giới thiệu!");
  });

  it("should copy sample message to clipboard", async () => {
    const clipboardSpy = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardSpy,
      },
    });
    const showSuccessSpy = vi.spyOn(toastHelper, "showSuccess").mockImplementation(() => {});

    renderComponent();

    const copyMsgBtn = screen.getByRole("button", { name: "Sao chép câu mời" });
    fireEvent.click(copyMsgBtn);

    expect(clipboardSpy).toHaveBeenCalledWith(
      "Nhập mã K7QX4MZP trên PalmSight: bạn được thêm 5 GEM xem bói miễn phí"
    );
    expect(showSuccessSpy).toHaveBeenCalledWith("Đã sao chép câu mời mẫu!");
  });

  it("should display stats and list of invited users with proper statuses", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("referral-stats")).toHaveTextContent(
        "3 lượt được thưởng · +7 GEM"
      );
      expect(screen.getByText("Lê C***")).toBeInTheDocument();
      expect(screen.getByText("Phạm D***")).toBeInTheDocument();
      expect(screen.getByText("Người dùng đã xoá")).toBeInTheDocument();

      expect(screen.getByText("Vũ E***")).toBeInTheDocument();

      // REWARDED items: bản ghi cũ giữ +2, bản ghi mới +3
      expect(screen.getAllByText("+2 GEM").length).toBe(2);
      expect(screen.getAllByText("+3 GEM").length).toBe(1);

      // CAPPED item
      expect(
        screen.getByText("Đã ghi nhận · không cộng (hết lượt hôm nay)")
      ).toBeInTheDocument();
    });
  });

  it("should list referral rewards using CREDIT_AMOUNTS and GEM", () => {
    renderComponent();

    expect(
      screen.getByText(/Mỗi người đăng ký bằng mã của bạn, bạn nhận \+3 GEM/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Tối đa 5 lượt thưởng mỗi ngày/)).toBeInTheDocument();
    expect(
      screen.getByText(/Người được bạn mời nhận \+5 GEM khi nhập mã của bạn/)
    ).toBeInTheDocument();
  });

  it("should show empty state when no referrals exist", async () => {
    renderComponent({
      totalRewarded: 0,
      totalCreditsEarned: 0,
      items: [],
      nextCursor: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("empty-referrals")).toHaveTextContent(
        "Chưa có ai sử dụng mã giới thiệu của bạn. Hãy chia sẻ mã để nhận thêm GEM!"
      );
    });
  });
});
