import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Scan from "./index";
import httpService from "@/services/httpService";
import { AuthenticationProvider, useAuth } from "@/providers/AuthenticationProvider";
import readingsService from "@/services/readingsService";
import * as toastHelper from "@/helpers/toast";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
} from "@palmsight/shared";

const BalanceProbe = () => (
  <span data-testid="balance-probe">{useAuth().user?.creditBalance}</span>
);

describe("Scan Page (/scan)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const mockUser = {
    id: "user-123",
    displayName: "Test User",
    username: "testuser",
    avatarUrl: null,
    referralCode: "ABCDEF12",
    creditBalance: 5,
    referral: {
      canEnterCode: true,
      enteredCode: null,
    },
  };

  const renderScan = (userOverride = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/scan"]}>
          <AuthenticationProvider
            skipInitialRefresh
            initialUser={{ ...mockUser, ...userOverride }}
          >
            <BalanceProbe />
            <Routes>
              <Route path="/scan" element={<Scan />} />
              <Route
                path="/readings/:id"
                element={<div data-testid="reading-detail-mock">Reading Detail</div>}
              />
            </Routes>
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render 3 schools and show Western school selected by default, with Eastern/Vedic VIP-locked", () => {
    renderScan();

    expect(screen.getByText("1. Trường phái")).toBeInTheDocument();
    expect(screen.getByText(/Chỉ tay phương Tây/)).toBeInTheDocument();
    expect(screen.getByText(/Chỉ tay phương Đông/)).toBeInTheDocument();
    expect(screen.getByText(/Chỉ tay Ấn Độ/)).toBeInTheDocument();

    // Western school selected by default
    expect(screen.getByText(/\(x\) Chỉ tay phương Tây/)).toBeInTheDocument();

    // Eastern and Vedic schools locked with VIP tag
    const vipTags = screen.getAllByText("Chỉ VIP, mua trên app Android");
    expect(vipTags).toHaveLength(2);

    // Eastern hint is not displayed by default because Western is selected
    expect(
      screen.queryByText("[i] Nam xem tay trái, nữ xem tay phải.")
    ).not.toBeInTheDocument();

    // Fixed price note
    expect(
      screen.getByText("[i] Giá 5 GEM, dù chọn bao nhiêu mục")
    ).toBeInTheDocument();
  });

  it("should automatically reset Eastern or Vedic in localStorage to Western and prevent selecting VIP schools", () => {
    const showErrorSpy = vi.spyOn(toastHelper, "showError");
    localStorage.setItem("palmsight_last_school", ReadingSchool.EASTERN);

    renderScan();

    // Should have reset to Western
    expect(localStorage.getItem("palmsight_last_school")).toBe(
      ReadingSchool.WESTERN
    );
    expect(screen.getByText(/\(x\) Chỉ tay phương Tây/)).toBeInTheDocument();

    // Clicking locked VIP school shows error toast
    fireEvent.click(screen.getByText(/Chỉ tay phương Đông/));
    expect(showErrorSpy).toHaveBeenCalledWith(
      "Trường phái này chỉ dành cho tài khoản VIP. Bạn vui lòng nâng cấp VIP trên ứng dụng Android hoặc chọn trường phái Phương Tây."
    );
  });

  it("should handle 403 vip_required by showing friendly VIP error message", async () => {
    const showErrorSpy = vi.spyOn(toastHelper, "showError");
    vi.spyOn(httpService, "post").mockRejectedValue({
      response: {
        status: 403,
        data: {
          error: {
            code: "vip_required",
            message: "Trường phái chỉ tay Phương Đông và Ấn Độ (Vedic) chỉ dành cho thành viên VIP.",
          },
        },
      },
    });

    renderScan();

    const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId("ai-consent-checkbox"));
    fireEvent.click(screen.getByTestId("submit-reading-button"));

    await waitFor(() => {
      expect(showErrorSpy).toHaveBeenCalledWith(
        "Trường phái này chỉ dành cho tài khoản VIP. Bạn vui lòng nâng cấp VIP trên ứng dụng Android hoặc chọn trường phái Phương Tây."
      );
      expect(screen.getByTestId("network-error-banner")).toHaveTextContent(
        "Trường phái này chỉ dành cho tài khoản VIP. Bạn vui lòng nâng cấp VIP trên ứng dụng Android hoặc chọn trường phái Phương Tây."
      );
    });
  });

  it("should manage 'Bói toàn bộ' toggling correctly", () => {
    renderScan();

    const toggleAllBtn = screen.getByTestId("toggle-all-topics");
    expect(toggleAllBtn).toHaveTextContent("[x] Bói toàn bộ");

    // Uncheck "Bói toàn bộ"
    fireEvent.click(toggleAllBtn);
    expect(toggleAllBtn).toHaveTextContent("[ ] Bói toàn bộ");

    // Manually toggle section
    const sectionBtn = screen.getByTestId("topic-section-handShape");
    fireEvent.click(sectionBtn); // uncheck
    expect(sectionBtn).toHaveTextContent("[ ]");
  });

  it("should allow selecting hand left or right", () => {
    renderScan();

    const handRight = screen.getByTestId("hand-right");
    fireEvent.click(handRight);
    expect(handRight).toHaveTextContent("(x) Tay phải");
    expect(screen.getByTestId("selection-summary")).toHaveTextContent(
      "Tay phải"
    );
  });

  it("should render camera viewfinder, prompt text matching AC 1, and fallback file input", () => {
    renderScan();

    expect(
      screen.getByText("Đủ sáng, xòe ngón tay, lòng bàn tay hướng thẳng camera.")
    ).toBeInTheDocument();

    const fileInput = screen.getByTestId("file-input");
    expect(fileInput).toHaveAttribute("accept", "image/*");
    expect(fileInput).toHaveAttribute("capture", "environment");

    const video = screen.getByTestId("camera-video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveClass("hidden");
  });

  it("should show banner and disable submission if user credit is 0", () => {
    renderScan({ creditBalance: 0 });

    expect(
      screen.getByTestId("insufficient-credits-banner")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mời bạn bè nhập mã để nhận 3 GEM:")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Có mã của bạn bè\?/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Nhập để nhận 5 GEM/i })
    ).toBeInTheDocument();

    expect(screen.getByText("Không đủ GEM")).toBeInTheDocument();
    const submitBtn = screen.getByTestId("submit-reading-button");
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent("Xem bói (−5 GEM)");
  });

  it("should enable submit button only when image is provided and consent is checked", () => {
    renderScan();

    const submitBtn = screen.getByTestId("submit-reading-button");
    expect(submitBtn).toBeDisabled();

    // Upload an image
    const file = new File(["dummy content"], "palm.png", { type: "image/png" });
    const fileInput = screen.getByTestId("file-input");
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Submit still disabled without consent
    expect(submitBtn).toBeDisabled();

    // Check consent
    const consentCheckbox = screen.getByTestId("ai-consent-checkbox");
    fireEvent.click(consentCheckbox);

    // Now submit button is enabled
    expect(submitBtn).not.toBeDisabled();
  });

  it("should submit reading with idempotency key and redirect to /readings/:id on success", async () => {
    const postSpy = vi.spyOn(httpService, "post").mockResolvedValue({
      data: {
        reading: {
          id: "reading-abc",
          status: ReadingStatus.DONE,
          school: ReadingSchool.EASTERN,
          topics: ["nguHanh"],
          hand: HandOrientation.LEFT,
          result: {
            isPalm: true,
            summary: "Lòng bàn tay rất tốt",
          },
          rejectReason: null,
          createdAt: "2026-10-15T00:00:00Z",
          completedAt: "2026-10-15T00:00:10Z",
        },
        creditBalance: 2,
      },
    } as any);

    renderScan();

    // Select file & check consent
    const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId("ai-consent-checkbox"));

    // Submit
    fireEvent.click(screen.getByTestId("submit-reading-button"));

    // Check analyzing view
    expect(screen.getByTestId("analyzing-view")).toBeInTheDocument();

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalled();
      const callArgs = postSpy.mock.calls[0];
      expect(callArgs[2]?.headers?.["Idempotency-Key"]).toBeDefined();
      expect(screen.getByTestId("reading-detail-mock")).toBeInTheDocument();
    });
  });

  it("should handle REJECTED status and show reason with credit refunded", async () => {
    vi.spyOn(httpService, "post").mockResolvedValue({
      data: {
        reading: {
          id: "reading-rejected",
          status: ReadingStatus.REJECTED,
          school: ReadingSchool.EASTERN,
          topics: [],
          hand: HandOrientation.LEFT,
          result: null,
          rejectReason: "Ảnh quá tối, không nhìn rõ các đường chỉ tay.",
          createdAt: "2026-10-15T00:00:00Z",
          completedAt: "2026-10-15T00:00:05Z",
        },
        creditBalance: 3,
      },
    } as any);

    renderScan();

    const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId("ai-consent-checkbox"));
    fireEvent.click(screen.getByTestId("submit-reading-button"));

    await waitFor(() => {
      expect(screen.getByTestId("rejected-banner")).toBeInTheDocument();
      expect(
        screen.getByText("Ảnh quá tối, không nhìn rõ các đường chỉ tay.")
      ).toBeInTheDocument();
      expect(screen.getByText("[+] Đã hoàn 5 GEM")).toBeInTheDocument();
    });
  });

  it.each([1, 2, 3, 4])(
    "should block submission when the balance of %i GEM is below the price",
    (creditBalance) => {
      renderScan({ creditBalance });

      expect(
        screen.getByTestId("insufficient-credits-banner")
      ).toBeInTheDocument();
      expect(screen.getByTestId("submit-reading-button")).toBeDisabled();
    }
  );

  it("should allow submission when the balance equals the price", () => {
    renderScan({ creditBalance: 5 });

    expect(
      screen.queryByTestId("insufficient-credits-banner")
    ).not.toBeInTheDocument();
  });

  it("should keep the real balance from a 402 instead of forcing 0", async () => {
    vi.spyOn(httpService, "post").mockRejectedValue({
      response: {
        status: 402,
        data: {
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: "Bạn không đủ GEM để xem bói.",
            details: { required: 5, balance: 3 },
          },
        },
      },
    });

    renderScan();

    const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId("ai-consent-checkbox"));
    fireEvent.click(screen.getByTestId("submit-reading-button"));

    await waitFor(() => {
      expect(screen.getByTestId("balance-probe")).toHaveTextContent("3");
    });
    expect(
      screen.getByTestId("insufficient-credits-banner")
    ).toBeInTheDocument();
  });

  it("should handle 503 AI_UNAVAILABLE with retry", async () => {
    vi.spyOn(httpService, "post").mockRejectedValue({
      response: {
        status: 503,
        data: {
          error: {
            code: "AI_UNAVAILABLE",
            message: "Hệ thống bận, đã hoàn lại GEM. Vui lòng thử lại.",
            details: { refunded: true, creditBalance: 3 },
          },
        },
      },
    });

    renderScan();

    const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId("ai-consent-checkbox"));
    fireEvent.click(screen.getByTestId("submit-reading-button"));

    await waitFor(() => {
      expect(screen.getByTestId("ai-unavailable-banner")).toHaveTextContent(
        "[!] Hệ thống bận, đã hoàn 5 GEM. Thử lại sau ít phút."
      );
      expect(screen.getByTestId("retry-ai-button")).toBeInTheDocument();
    });
  });

  it("should handle 409 READING_IN_PROGRESS and poll until completion", async () => {
    vi.spyOn(httpService, "post").mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            code: "READING_IN_PROGRESS",
            message: "Lần xem bói trước vẫn đang xử lý.",
            details: { readingId: "rd-poll-123" },
          },
        },
      },
    });

    const getSpy = vi.spyOn(httpService, "get").mockResolvedValue({
      data: {
        id: "rd-poll-123",
        status: ReadingStatus.DONE,
        school: ReadingSchool.EASTERN,
        topics: [],
        hand: HandOrientation.LEFT,
        result: { isPalm: true },
        createdAt: "2026-10-15T00:00:00Z",
      },
    } as any);

    renderScan();

    const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId("ai-consent-checkbox"));
    fireEvent.click(screen.getByTestId("submit-reading-button"));

    // Remains in analyzing state
    expect(screen.getByTestId("analyzing-view")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(getSpy).toHaveBeenCalled();
        expect(screen.getByTestId("reading-detail-mock")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  describe("Guest Trial Scan Flow (US-GUEST-001)", () => {
    const renderScanAsGuest = () => {
      return render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/scan"]}>
            <AuthenticationProvider skipInitialRefresh initialUser={null}>
              <Routes>
                <Route path="/scan" element={<Scan />} />
                <Route
                  path="/guest/reading/:token"
                  element={<div data-testid="guest-preview-mock">Guest Preview</div>}
                />
              </Routes>
            </AuthenticationProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );
    };

    it("should allow unauthenticated guest to submit scan and redirect to /guest/reading/:token", async () => {
      const guestSpy = vi
        .spyOn(readingsService, "createGuestReading")
        .mockResolvedValueOnce({
          claimToken: "guest-token-123",
          reading: {
            id: "reading-guest-1",
            claimToken: "guest-token-123",
            status: ReadingStatus.GUEST_PREVIEW,
          } as any,
        });

      renderScanAsGuest();

      const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
      fireEvent.change(screen.getByTestId("file-input"), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByTestId("ai-consent-checkbox"));

      // Guest submit button has guest text
      const submitBtn = screen.getByTestId("submit-reading-button");
      expect(submitBtn).toHaveTextContent("Bói thử miễn phí");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(guestSpy).toHaveBeenCalledWith(
          expect.any(FormData),
          expect.any(String)
        );
        expect(screen.getByTestId("guest-preview-mock")).toBeInTheDocument();
      });
    });

    it("should handle 403 GUEST_TRIAL_LIMIT_REACHED by showing toast message and limit-reached banner", async () => {
      const showErrorSpy = vi.spyOn(toastHelper, "showError");
      vi.spyOn(readingsService, "createGuestReading").mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            error: {
              code: "GUEST_TRIAL_LIMIT_REACHED",
              message:
                "Bạn đã sử dụng hết 1 lượt bói thử miễn phí. Hãy đăng ký tài khoản để tiếp tục trải nghiệm!",
            },
          },
        },
      });

      renderScanAsGuest();

      const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
      fireEvent.change(screen.getByTestId("file-input"), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByTestId("ai-consent-checkbox"));
      fireEvent.click(screen.getByTestId("submit-reading-button"));

      await waitFor(() => {
        expect(showErrorSpy).toHaveBeenCalledWith(
          "Bạn đã sử dụng hết 1 lượt bói thử miễn phí. Hãy đăng ký tài khoản để tiếp tục trải nghiệm!"
        );
        expect(screen.getByTestId("limit-reached-banner")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Đăng ký tài khoản" })).toHaveAttribute(
          "href",
          "/register"
        );
        expect(screen.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute(
          "href",
          "/login"
        );
      });
    });

    it("should handle 429 IP_TRIAL_LIMIT_EXCEEDED with rate-limited banner and toast (no network error banner)", async () => {
      const showErrorSpy = vi.spyOn(toastHelper, "showError");
      vi.spyOn(readingsService, "createGuestReading").mockRejectedValueOnce({
        response: {
          status: 429,
          data: {
            error: {
              code: "IP_TRIAL_LIMIT_EXCEEDED",
              message:
                "Địa chỉ mạng của bạn đã đạt giới hạn 5 lượt bói thử trong ngày. Vui lòng đăng ký tài khoản để tiếp tục!",
            },
          },
        },
      });

      renderScanAsGuest();

      const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
      fireEvent.change(screen.getByTestId("file-input"), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByTestId("ai-consent-checkbox"));
      fireEvent.click(screen.getByTestId("submit-reading-button"));

      await waitFor(() => {
        expect(showErrorSpy).toHaveBeenCalledWith(
          "Địa chỉ IP đã đạt tối đa 5 lượt bói thử hôm nay. Đăng ký tài khoản để tiếp tục bói không giới hạn."
        );
        expect(screen.getByTestId("rate-limited-banner")).toBeInTheDocument();
        expect(screen.queryByTestId("network-error-banner")).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Đăng ký tài khoản" })).toHaveAttribute(
          "href",
          "/register"
        );
      });
    });

    it("should not promise a GEM refund when a guest trial hits AI_UNAVAILABLE", async () => {
      vi.spyOn(readingsService, "createGuestReading").mockRejectedValueOnce({
        response: {
          status: 503,
          data: { error: { code: "AI_UNAVAILABLE", message: "Hệ thống bận." } },
        },
      });

      renderScanAsGuest();

      const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
      fireEvent.change(screen.getByTestId("file-input"), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByTestId("ai-consent-checkbox"));
      fireEvent.click(screen.getByTestId("submit-reading-button"));

      await waitFor(() => {
        expect(screen.getByTestId("ai-unavailable-banner")).toHaveTextContent(
          "[!] Hệ thống bận. Thử lại sau ít phút."
        );
      });
      expect(screen.queryByText(/đã hoàn/i)).not.toBeInTheDocument();
    });

    it("should handle REJECTED status with friendly Vietnamese toast message", async () => {
      const showErrorSpy = vi.spyOn(toastHelper, "showError");
      vi.spyOn(readingsService, "createGuestReading").mockResolvedValueOnce({
        claimToken: "guest-token-123",
        reading: {
          id: "reading-guest-rejected",
          claimToken: "guest-token-123",
          status: ReadingStatus.REJECTED,
          rejectReason:
            "Không nhận diện được lòng bàn tay. Vui lòng chụp rõ lòng bàn tay và thử lại!",
        } as any,
      });

      renderScanAsGuest();

      const file = new File(["dummy"], "palm.jpg", { type: "image/jpeg" });
      fireEvent.change(screen.getByTestId("file-input"), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByTestId("ai-consent-checkbox"));
      fireEvent.click(screen.getByTestId("submit-reading-button"));

      await waitFor(() => {
        expect(showErrorSpy).toHaveBeenCalledWith(
          "Không nhận diện được lòng bàn tay. Vui lòng chụp rõ lòng bàn tay và thử lại!"
        );
        expect(screen.getByTestId("rejected-banner")).toBeInTheDocument();
      });
      expect(screen.queryByText(/đã hoàn/i)).not.toBeInTheDocument();
    });
  });
});
