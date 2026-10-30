import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DataDeletion, { Terms, Privacy } from "./index";

describe("DataDeletion Page and Static Info Pages", () => {
  const renderWithRouter = (initialPath = "/data-deletion") => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("should render Data Deletion instructions with ADR-0009 requirements", () => {
    renderWithRouter("/data-deletion");

    // Title & Intro
    expect(screen.getByRole("heading", { name: "Xoá dữ liệu của bạn" })).toBeInTheDocument();
    expect(screen.getByText("Cập nhật: 15/10/2026")).toBeInTheDocument();

    // Email procedure
    expect(screen.getByText(/palmsight\.app@gmail\.com/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Quy trình yêu cầu xoá \(Thủ công qua email\)/i)
    ).toBeInTheDocument();

    // No in-app self-service button notice (ADR-0009)
    expect(
      screen.getByText(/không có nút tự xoá tự phục vụ/i)
    ).toBeInTheDocument();

    // 30 days processing timeframe
    expect(screen.getByText(/30 ngày/i)).toBeInTheDocument();

    // Data deleted list
    expect(screen.getByText(/Những gì bị xoá vĩnh viễn/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Lịch sử các bài bói và toàn bộ kết quả luận giải chi tiết/i)
    ).toBeInTheDocument();

    // No image storage notice (ADR-0010)
    expect(screen.getByText(/hoàn toàn không lưu trữ ảnh chụp lòng bàn tay/i)).toBeInTheDocument();

    // Warning when re-registering (0 credit & cannot enter referral code)
    expect(
      screen.getByText(/tài khoản sẽ bắt đầu với 0 credit/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/không được quyền nhập mã giới thiệu/i)
    ).toBeInTheDocument();
  });

  it("should render Terms of Service content when visiting /terms", () => {
    renderWithRouter("/terms");

    expect(screen.getByRole("heading", { name: "Điều khoản dịch vụ" })).toBeInTheDocument();
    expect(screen.getByText(/Mục đích giải trí/i)).toBeInTheDocument();
    expect(
      screen.getByText(/không có giá trị thay thế cho các lời khuyên, chẩn đoán hay tư vấn chuyên môn/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Mỗi lượt luận giải chỉ tay tiêu tốn chính xác 1 credit/i)).toBeInTheDocument();
  });

  it("should render Privacy Policy content when visiting /privacy", () => {
    renderWithRouter("/privacy");

    expect(screen.getByRole("heading", { name: "Chính sách riêng tư" })).toBeInTheDocument();
    expect(
      screen.getByText(/Chính sách không lưu trữ ảnh lòng bàn tay/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Mọi siêu dữ liệu EXIF \(vị trí địa lý GPS, dòng máy, thời gian chụp\) đều bị xoá bỏ/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Lưu trữ mã băm định danh đã xoá \(ADR-0009\)/i)).toBeInTheDocument();
  });

  it("should switch tabs when clicking tab navigation links", () => {
    renderWithRouter("/data-deletion");

    expect(screen.getByRole("heading", { name: "Xoá dữ liệu của bạn" })).toBeInTheDocument();

    const termsTab = screen.getByRole("link", { name: "Điều khoản" });
    fireEvent.click(termsTab);

    expect(screen.getByRole("heading", { name: "Điều khoản dịch vụ" })).toBeInTheDocument();

    const privacyTab = screen.getByRole("link", { name: "Chính sách riêng tư" });
    fireEvent.click(privacyTab);

    expect(screen.getByRole("heading", { name: "Chính sách riêng tư" })).toBeInTheDocument();
  });
});
