import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReadingsHistory from "./index";
import httpService from "@/services/httpService";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
  ReadingListItemDto,
} from "@palmsight/shared";

describe("ReadingsHistory Page (/readings)", () => {
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
    id: "user-123",
    displayName: "Test User",
    username: "testuser",
    avatarUrl: null,
    referralCode: "ABCDEF12",
    creditBalance: 3,
  };

  const mockItems: ReadingListItemDto[] = [
    {
      id: "rd-1",
      status: ReadingStatus.DONE,
      school: ReadingSchool.EASTERN,
      topics: ["nguHanh", "thienVan", "nhanVan"],
      hand: HandOrientation.LEFT,
      summary: "Tay Thổ, thực tế và đáng tin cậy. Tình cảm chân thành, chậm mà chắc.",
      createdAt: "2026-10-14T08:31:00Z",
    },
    {
      id: "rd-2",
      status: ReadingStatus.DONE,
      school: ReadingSchool.WESTERN,
      topics: [],
      hand: HandOrientation.RIGHT,
      summary: "Dáng tay hệ Khí, đường trí tuệ dài và thẳng, thiên về suy nghĩ logic.",
      createdAt: "2026-10-12T19:20:00Z",
    },
    {
      id: "rd-3",
      status: ReadingStatus.FAILED,
      school: ReadingSchool.WESTERN,
      topics: ["heartLine"],
      hand: HandOrientation.RIGHT,
      summary: null,
      createdAt: "2026-10-13T10:02:00Z",
    },
    {
      id: "rd-4",
      status: ReadingStatus.REJECTED,
      school: ReadingSchool.VEDIC,
      topics: [],
      hand: HandOrientation.LEFT,
      summary: null,
      createdAt: "2026-10-11T21:45:00Z",
    },
    {
      id: "rd-5",
      status: ReadingStatus.PROCESSING,
      school: ReadingSchool.EASTERN,
      topics: ["thienVan", "diaVan"],
      hand: HandOrientation.RIGHT,
      summary: null,
      createdAt: "2026-10-10T07:00:00Z",
    },
  ];

  const renderComponent = (items = mockItems, nextCursor: string | null = null) => {
    vi.spyOn(httpService, "get").mockResolvedValue({
      data: {
        items,
        nextCursor,
      },
    } as any);

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/readings"]}>
          <AuthenticationProvider skipInitialRefresh initialUser={mockUser}>
            <Routes>
              <Route path="/readings" element={<ReadingsHistory />} />
              <Route
                path="/readings/:id"
                element={<div data-testid="detail-page-mock">Detail Page</div>}
              />
              <Route
                path="/scan"
                element={<div data-testid="scan-page-mock">Scan Page</div>}
              />
            </Routes>
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render history table with items and status badges", async () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: "Lịch sử xem bói" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("✦ 5 quẻ đã lưu")).toBeInTheDocument();
      expect(screen.getByText(/Phương Đông · Tay trái · 3 mục/)).toBeInTheDocument();
      expect(screen.getByText("Dáng tay ngũ hành, Thiên văn, Nhân văn")).toBeInTheDocument();
      expect(screen.getByText(/Phương Tây · Tay phải · Toàn bộ/)).toBeInTheDocument();

      expect(
        screen.getByText("Tay Thổ, thực tế và đáng tin cậy. Tình cảm chân thành, chậm mà chắc.")
      ).toBeInTheDocument();

      expect(screen.getAllByText("[+] Xong").length).toBe(2);
      expect(screen.getByText("[!] Hệ thống bận · đã hoàn 1 credit")).toBeInTheDocument();
      expect(screen.getByText("[!] Ảnh không rõ · đã hoàn 1 credit")).toBeInTheDocument();
      expect(screen.getByText("[...] Đang xử lý")).toBeInTheDocument();
    });
  });

  it("should navigate to /readings/:id when clicking on a DONE item", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("reading-item-rd-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("reading-item-rd-1"));

    await waitFor(() => {
      expect(screen.getByTestId("detail-page-mock")).toBeInTheDocument();
    });
  });

  it("should show empty state message and button when no readings exist", async () => {
    renderComponent([]);

    await waitFor(() => {
      expect(screen.getByTestId("empty-readings")).toBeInTheDocument();
      expect(screen.getByText("Chưa có lần xem bói nào trong lịch sử.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Bắt đầu xem bói" })).toHaveAttribute("href", "/scan");
    });
  });

  it("should have a '+ Xem bói mới' button linking to /scan", async () => {
    renderComponent();

    const newBtn = screen.getByTestId("new-reading-btn");
    expect(newBtn).toBeInTheDocument();
    expect(newBtn).toHaveAttribute("href", "/scan");
  });
});
