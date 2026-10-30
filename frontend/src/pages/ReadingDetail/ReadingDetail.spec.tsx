import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReadingDetail from "./index";
import httpService from "@/services/httpService";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
  ImageQuality,
  ReadingDto,
} from "@palmsight/shared";

describe("ReadingDetail Page (/readings/:id)", () => {
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

  const mockReading: ReadingDto = {
    id: "rd-123",
    status: ReadingStatus.DONE,
    school: ReadingSchool.EASTERN,
    topics: ["nguHanh", "thienVan"],
    hand: HandOrientation.LEFT,
    result: {
      isPalm: true,
      school: ReadingSchool.EASTERN,
      hand: HandOrientation.LEFT,
      imageQuality: ImageQuality.GOOD,
      topics: ["nguHanh", "thienVan"],
      summary:
        "Tay Thổ, thực tế và đáng tin cậy. Tình cảm chân thành, chậm mà chắc.",
      sections: [
        {
          key: "nguHanh",
          title: "Dáng tay ngũ hành",
          observation: "Lòng bàn tay vuông, ngón ngắn và chắc.",
          meaning: "Tay Thổ: thực tế, đáng tin cậy, làm việc đâu ra đó.",
        },
        {
          key: "thienVan",
          title: "Thiên văn",
          observation: "Đường dài, cong nhẹ, khá rõ và không bị đứt đoạn.",
          meaning: "Tình cảm sâu sắc và chân thành.",
        },
      ],
      aspects: {
        love: "Bạn coi trọng sự bền vững hơn những rung động nhất thời.",
      },
      advice: "Dành thời gian nói ra điều bạn nghĩ với người thân.",
      disclaimer:
        "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
    },
    rejectReason: null,
    createdAt: "2026-10-14T08:31:00Z",
    completedAt: "2026-10-14T08:31:07Z",
  };

  const renderComponent = (
    readingData: any = mockReading,
    errorToThrow: any = null
  ) => {
    if (errorToThrow) {
      vi.spyOn(httpService, "get").mockRejectedValue(errorToThrow);
    } else {
      vi.spyOn(httpService, "get").mockResolvedValue({
        data: readingData,
      } as any);
    }

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/readings/rd-123"]}>
          <AuthenticationProvider skipInitialRefresh initialUser={mockUser}>
            <Routes>
              <Route path="/readings/:id" element={<ReadingDetail />} />
              <Route
                path="/readings"
                element={
                  <div data-testid="readings-history-page">History Page</div>
                }
              />
              <Route
                path="/scan"
                element={<div data-testid="scan-page">Scan Page</div>}
              />
            </Routes>
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render reading detail with summary, sections, aspects, advice, disclaimer", async () => {
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getAllByText("Chỉ tay phương Đông").length
      ).toBeGreaterThan(0);
      expect(screen.getByText("Tóm tắt")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Tay Thổ, thực tế và đáng tin cậy. Tình cảm chân thành, chậm mà chắc."
        )
      ).toBeInTheDocument();

      expect(screen.getAllByText("Dáng tay ngũ hành").length).toBeGreaterThan(
        0
      );
      expect(screen.getAllByText("Thiên văn").length).toBeGreaterThan(0);
      expect(
        screen.getByText("Lòng bàn tay vuông, ngón ngắn và chắc.")
      ).toBeInTheDocument();

      expect(screen.getByText("Khía cạnh cuộc sống")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Bạn coi trọng sự bền vững hơn những rung động nhất thời."
        )
      ).toBeInTheDocument();

      expect(screen.getByText("Lời khuyên")).toBeInTheDocument();
      expect(
        screen.getByText("Dành thời gian nói ra điều bạn nghĩ với người thân.")
      ).toBeInTheDocument();
      expect(screen.getByTestId("reading-disclaimer")).toHaveTextContent(
        "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn."
      );
    });

    expect(screen.queryByAltText(/palm/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("reading-emblem")).toHaveTextContent(
      "NO_IMAGE_STORED // ADR-0010"
    );
  });

  it("should render palm image and AI palm lines toggle when imageUrl and palmLines are stored (ADR-0011)", async () => {
    const readingWithImage: ReadingDto = {
      ...mockReading,
      imageUrl: "https://res.cloudinary.com/demo/image/upload/palm.jpg",
      annotatedImageUrl:
        "https://res.cloudinary.com/demo/image/upload/palm_lines.jpg",
      palmLines: [
        {
          name: "life",
          points: [
            [0.6, 0.4],
            [0.55, 0.8],
          ],
          lengthRel: 0.45,
          curvature: 1.15,
          branches: 1,
        },
        {
          name: "head",
          points: [
            [0.3, 0.45],
            [0.7, 0.42],
          ],
          lengthRel: 0.4,
          curvature: 1.05,
          branches: 0,
        },
      ],
    };

    renderComponent(readingWithImage);

    await waitFor(() => {
      expect(screen.getByTestId("reading-palm-viewer")).toBeInTheDocument();
      const img = screen.getByTestId("reading-palm-image") as HTMLImageElement;
      expect(img.src).toContain("palm_lines.jpg");
      expect(screen.getByTestId("reading-palm-legend")).toHaveTextContent(
        "Sinh đạo"
      );
      expect(screen.getByTestId("reading-palm-legend")).toHaveTextContent(
        "Trí đạo"
      );
    });

    fireEvent.click(screen.getByTestId("reading-toggle-lines-button"));
    const imgAfterToggle = screen.getByTestId(
      "reading-palm-image"
    ) as HTMLImageElement;
    expect(imgAfterToggle.src).toContain("palm.jpg");
  });

  it("should show warning banner when image quality is POOR", async () => {
    const poorReading = {
      ...mockReading,
      result: {
        ...mockReading.result,
        imageQuality: ImageQuality.POOR,
      },
    };
    renderComponent(poorReading);

    await waitFor(() => {
      expect(screen.getByTestId("poor-quality-warning")).toHaveTextContent(
        "[!] Ảnh hơi mờ, kết quả có thể chưa chính xác."
      );
    });
  });

  it("should navigate to /scan when clicking 'Bói thêm mục khác / trường phái khác'", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("re-scan-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("re-scan-button"));
    expect(screen.getByTestId("scan-page")).toBeInTheDocument();
  });

  it("should copy text to clipboard when clicking 'Chia sẻ phần chữ'", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("share-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("share-button"));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      const sharedText = writeTextMock.mock.calls[0][0];
      expect(sharedText).toContain("Mục xem: Dáng tay ngũ hành, Thiên văn");
      expect(screen.getByText("Đã sao chép văn bản")).toBeInTheDocument();
    });
  });

  it("should render selected topics tags and banner when user selected specific topics", async () => {
    const topicsReading: ReadingDto = {
      ...mockReading,
      topics: ["personality", "career"],
      result: {
        ...(mockReading.result as NonNullable<typeof mockReading.result>),
        topics: ["personality", "career"],
        sections: [],
        aspects: {
          personality: "Rất điềm tĩnh",
          career: "Tiến triển tốt",
        },
      },
    };
    renderComponent(topicsReading);

    await waitFor(() => {
      const banner = screen.getByTestId("selected-topics-banner");
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent("Tính cách");
      expect(banner).toHaveTextContent("Sự nghiệp");

      const headerTags = screen.getByTestId("reading-selected-topics");
      expect(headerTags).toBeInTheDocument();
      expect(headerTags).toHaveTextContent("[Tính cách]");
      expect(headerTags).toHaveTextContent("[Sự nghiệp]");
    });
  });

  it("should open delete modal and call delete API when confirmed", async () => {
    const deleteSpy = vi
      .spyOn(httpService, "delete")
      .mockResolvedValue({} as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("delete-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("delete-button"));

    expect(screen.getByTestId("delete-modal")).toBeInTheDocument();
    expect(
      screen.getByText(/Bạn có chắc chắn muốn xoá lần xem bói này\?/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith("/api/v1/readings/rd-123");
      expect(screen.getByTestId("readings-history-page")).toBeInTheDocument();
    });
  });

  it("should show 404 message when reading is not found", async () => {
    renderComponent(null, {
      response: { status: 404 },
    });

    await waitFor(() => {
      expect(
        screen.getByText("[!] Không tìm thấy lần xem bói")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Lần xem bói này không tồn tại hoặc đã bị xoá.")
      ).toBeInTheDocument();
    });
  });
});
