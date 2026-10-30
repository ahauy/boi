import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GuestReadingPreview from "./index";
import readingsService from "@/services/readingsService";
import { ReadingSchool, HandOrientation, ReadingStatus } from "@palmsight/shared";

const mockGuestReading = {
  id: "67139f7e-c885-4463-a62a-3a5e1fb83001",
  school: ReadingSchool.WESTERN,
  hand: HandOrientation.LEFT,
  topics: ["lifeLine", "headLine", "heartLine"],
  status: ReadingStatus.GUEST_PREVIEW,
  summary: "Bàn tay của bạn mang năng lượng Thổ với đường sinh đạo sâu và rõ nét...",
  sections: [
    {
      key: "lifeLine",
      title: "Đường Sinh Đạo (Life Line)",
      observation: "Đường cong sâu, rõ, không đứt đoạn.",
      meaning: "Bạn có thể chất dẻo dai và sức sống dồi dào.",
      isLocked: false,
    },
    {
      key: "headLine",
      title: "Đường Trí Đạo (Head Line)",
      observation: "Đường trí đạo thẳng, dài.",
      meaning: "Tư duy logic, thực tế.",
      isLocked: false,
    },
    {
      key: "heartLine",
      title: "Đường Tâm Đạo (Heart Line)",
      observation: null,
      meaning: null,
      isLocked: true,
    },
  ],
  aspects: {
    career: {
      title: "Sự nghiệp & Công danh",
      content: null,
      isLocked: true,
    },
  },
  advice: {
    content: null,
    isLocked: true,
  },
  disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
  previewExpiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  claimToken: "e4b8a21f-82df-4db3-9824-7128cf4291f0",
};

describe("GuestReadingPreview Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    sessionStorage.clear();
    localStorage.clear();
  });

  const renderComponent = (token = "e4b8a21f-82df-4db3-9824-7128cf4291f0") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/guest/reading/${token}`]}>
          <Routes>
            <Route path="/guest/reading/:token" element={<GuestReadingPreview />} />
            <Route path="/register" element={<div>Register Page Mock</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render loading skeleton while fetching preview", () => {
    vi.spyOn(readingsService, "getGuestReadingPreview").mockImplementation(
      () => new Promise(() => {})
    );
    renderComponent();
    expect(screen.getByTestId("preview-loading-skeleton")).toBeInTheDocument();
  });

  it("should render 404 state when reading preview is not found", async () => {
    vi.spyOn(readingsService, "getGuestReadingPreview").mockRejectedValue({
      response: { status: 404 },
    });
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText("Bài bói đã hết hạn hoặc không tồn tại")
      ).toBeInTheDocument();
      expect(screen.getByText("Bói quẻ mới")).toBeInTheDocument();
    });
  });

  it("should render 50% teaser preview with open sections, locked sections badge, summary, and sticky CTA", async () => {
    vi.spyOn(readingsService, "getGuestReadingPreview").mockResolvedValueOnce(
      mockGuestReading as any
    );

    renderComponent();

    await waitFor(() => {
      // Countdown banner
      expect(screen.getByTestId("countdown-banner")).toBeInTheDocument();

      // Summary
      expect(screen.getByTestId("preview-summary-card")).toHaveTextContent(
        "Bàn tay của bạn mang năng lượng Thổ"
      );

      // First 2 sections are open
      expect(screen.getByTestId("preview-section-open-lifeLine")).toBeInTheDocument();
      expect(screen.getByText("Đường Sinh Đạo (Life Line)")).toBeInTheDocument();
      expect(screen.getByText(/Đường cong sâu, rõ, không đứt đoạn/)).toBeInTheDocument();
      expect(screen.getByText(/Bạn có thể chất dẻo dai/)).toBeInTheDocument();

      expect(screen.getByTestId("preview-section-open-headLine")).toBeInTheDocument();
      expect(screen.getByText("Đường Trí Đạo (Head Line)")).toBeInTheDocument();

      expect(screen.getByRole("heading", { level: 1, name: "Bản xem trước kết quả bói chỉ tay" })).toBeInTheDocument();

      // Remaining sections are locked with ASCII badge
      expect(
        screen.getByTestId("preview-section-locked-heartLine")
      ).toBeInTheDocument();
      expect(screen.getByText("Đường Tâm Đạo (Heart Line)")).toBeInTheDocument();
      const lockedBadges = screen.getAllByTestId("locked-badge");
      expect(lockedBadges.length).toBeGreaterThan(0);
      expect(lockedBadges[0]).toHaveTextContent("[#] NỘI DUNG ĐÃ KHÓA");

      // Aspects and Advice
      expect(screen.getByTestId("preview-aspect-career")).toBeInTheDocument();
      expect(screen.getByTestId("preview-advice-block")).toBeInTheDocument();

      // Disclaimer
      expect(screen.getByTestId("preview-disclaimer")).toHaveTextContent(
        mockGuestReading.disclaimer
      );

      // Sticky CTA
      expect(screen.getByTestId("sticky-unlock-card")).toBeInTheDocument();
      expect(screen.getByTestId("unlock-now-button")).toHaveTextContent(
        "[ ĐĂNG KÝ MỞ KHÓA NGAY ]"
      );
    });
  });

  it("should store claimToken in sessionStorage and localStorage and navigate to /register on unlock click", async () => {
    vi.spyOn(readingsService, "getGuestReadingPreview").mockResolvedValueOnce(
      mockGuestReading as any
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("unlock-now-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("unlock-now-button"));

    expect(sessionStorage.getItem("ps_claim_token")).toBe(mockGuestReading.claimToken);
    expect(localStorage.getItem("ps_claim_token")).toBe(mockGuestReading.claimToken);
    await waitFor(() => {
      expect(screen.getByText("Register Page Mock")).toBeInTheDocument();
    });
  });
});
