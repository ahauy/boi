import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PalmViewer from "./PalmViewer";
import {
  ReadingSchool,
  HandOrientation,
  PalmLineDto,
} from "@palmsight/shared";
import * as palmUtils from "./palmUtils";

describe("PalmViewer Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockLines: PalmLineDto[] = [
    {
      name: "life",
      points: [
        [0.6, 0.4],
        [0.5, 0.6],
        [0.45, 0.8],
      ],
      lengthRel: 0.5,
      curvature: 1.1,
      branches: 0,
    },
    {
      name: "head",
      points: [
        [0.6, 0.42],
        [0.4, 0.5],
        [0.2, 0.55],
      ],
      lengthRel: 0.4,
      curvature: 1.05,
      branches: 0,
    },
    {
      name: "heart",
      points: [
        [0.2, 0.4],
        [0.4, 0.36],
        [0.6, 0.32],
      ],
      lengthRel: 0.45,
      curvature: 1.2,
      branches: 0,
    },
  ];

  const mockSections = [
    {
      key: "diaVan",
      title: "Địa văn",
      observation: "Đường nét liền mạch",
      meaning: "Sức khỏe dồi dào",
    },
    {
      key: "nhanVan",
      title: "Nhân văn",
      observation: "Đường dài rõ",
      meaning: "Trí tuệ minh mẫn",
    },
    {
      key: "thienVan",
      title: "Thiên văn",
      observation: "Đường sâu",
      meaning: "Tình cảm chân thành",
    },
  ];

  it("renders palm image when imageUrl is provided", () => {
    render(
      <PalmViewer
        imageUrl="https://example.com/palm.jpg"
        school={ReadingSchool.EASTERN}
        hand={HandOrientation.RIGHT}
      />
    );

    const img = screen.getByTestId("palm-viewer-image");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/palm.jpg");
  });

  it("renders mystical silhouette when no image is provided", () => {
    render(
      <PalmViewer
        school={ReadingSchool.WESTERN}
        hand={HandOrientation.LEFT}
      />
    );

    expect(screen.getByTestId("palm-viewer-silhouette")).toBeInTheDocument();
  });

  it("renders SVG palm lines and legend chips", () => {
    render(
      <PalmViewer
        imageUrl="https://example.com/palm.jpg"
        palmLines={mockLines}
        school={ReadingSchool.EASTERN}
        hand={HandOrientation.RIGHT}
        sections={mockSections}
      />
    );

    expect(screen.getByTestId("palm-viewer-svg")).toBeInTheDocument();
    expect(screen.getByTestId("palm-line-hitarea-life")).toBeInTheDocument();
    expect(screen.getByTestId("palm-line-hitarea-head")).toBeInTheDocument();
    expect(screen.getByTestId("palm-line-hitarea-heart")).toBeInTheDocument();

    expect(screen.getByTestId("palm-legend-button-life")).toHaveTextContent("Địa văn");
    expect(screen.getByTestId("palm-legend-button-head")).toHaveTextContent("Nhân văn");
    expect(screen.getByTestId("palm-legend-button-heart")).toHaveTextContent("Thiên văn");
  });

  it("toggles palm lines visibility when toggle button is clicked", () => {
    render(
      <PalmViewer
        imageUrl="https://example.com/palm.jpg"
        palmLines={mockLines}
      />
    );

    expect(screen.getByTestId("palm-viewer-svg")).toBeInTheDocument();
    const toggleBtn = screen.getByTestId("palm-viewer-toggle-button");
    expect(toggleBtn).toHaveTextContent("Ẩn đường chỉ tay");

    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId("palm-viewer-svg")).not.toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent("Hiện đường chỉ tay");

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("palm-viewer-svg")).toBeInTheDocument();
  });

  it("triggers scroll and onLineClick when a palm line is clicked", () => {
    const handleLineClick = vi.fn();
    const scrollSpy = vi.spyOn(palmUtils, "scrollToSection").mockReturnValue(true);

    render(
      <PalmViewer
        imageUrl="https://example.com/palm.jpg"
        palmLines={mockLines}
        school={ReadingSchool.EASTERN}
        sections={mockSections}
        onLineClick={handleLineClick}
      />
    );

    const lifeHitArea = screen.getByTestId("palm-line-hitarea-life");
    fireEvent.click(lifeHitArea);

    expect(handleLineClick).toHaveBeenCalledWith("life");
    expect(scrollSpy).toHaveBeenCalledWith("section-diaVan");
  });

  it("triggers scroll when a legend button is clicked", () => {
    const scrollSpy = vi.spyOn(palmUtils, "scrollToSection").mockReturnValue(true);

    render(
      <PalmViewer
        imageUrl="https://example.com/palm.jpg"
        palmLines={mockLines}
        school={ReadingSchool.EASTERN}
        sections={mockSections}
      />
    );

    const headLegendBtn = screen.getByTestId("palm-legend-button-head");
    fireEvent.click(headLegendBtn);

    expect(scrollSpy).toHaveBeenCalledWith("section-nhanVan");
  });

  it("shows tooltip on line hover and hides on mouse leave", () => {
    render(
      <PalmViewer
        imageUrl="https://example.com/palm.jpg"
        palmLines={mockLines}
        school={ReadingSchool.WESTERN}
      />
    );

    const heartHitArea = screen.getByTestId("palm-line-hitarea-heart");
    fireEvent.mouseEnter(heartHitArea, { clientX: 100, clientY: 100 });

    expect(screen.getByTestId("palm-line-hover-tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("palm-line-hover-tooltip")).toHaveTextContent("Tâm đạo");

    fireEvent.mouseLeave(heartHitArea);
    expect(screen.queryByTestId("palm-line-hover-tooltip")).not.toBeInTheDocument();
  });

  it("generates fallback canonical lines if palmLines array is empty", () => {
    render(
      <PalmViewer
        imageUrl="https://example.com/palm.jpg"
        palmLines={[]}
        school={ReadingSchool.WESTERN}
      />
    );

    expect(screen.getByTestId("palm-line-hitarea-life")).toBeInTheDocument();
    expect(screen.getByTestId("palm-line-hitarea-head")).toBeInTheDocument();
    expect(screen.getByTestId("palm-line-hitarea-heart")).toBeInTheDocument();
  });
});
