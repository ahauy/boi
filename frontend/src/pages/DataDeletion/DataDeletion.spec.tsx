import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  it("should render Data Deletion instructions consistent with the approved privacy policy", () => {
    const { container } = renderWithRouter("/data-deletion");

    // Title & Intro
    expect(screen.getByRole("heading", { name: "Xoá dữ liệu của bạn" })).toBeInTheDocument();
    expect(screen.getByText("Cập nhật: 15/10/2026")).toBeInTheDocument();

    // Email procedure
    expect(screen.getByText(/palmsight\.app@gmail\.com/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Quy trình yêu cầu xoá \(Thủ công qua email\)/i)
    ).toBeInTheDocument();

    // No in-app self-delete button; the Profile entry only opens this page
    expect(screen.getByText(/không có nút tự xoá tài khoản/i)).toBeInTheDocument();
    expect(screen.getByText(/Mục Hồ sơ trong ứng dụng chỉ mở trang này/i)).toBeInTheDocument();

    // 30 days processing timeframe
    expect(screen.getByText(/30 ngày/i)).toBeInTheDocument();

    // Data deleted list
    expect(screen.getByText(/Những gì bị xoá vĩnh viễn/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Lịch sử các bài bói và toàn bộ kết quả luận giải chi tiết/i)
    ).toBeInTheDocument();

    // Photos: stored on Cloudinary until the reading or account is deleted (policy sections 6 and 7)
    expect(screen.getByText(/Toàn bộ siêu dữ liệu EXIF, gồm vị trí GPS, bị xoá khỏi ảnh trước khi xử lý/i)).toBeInTheDocument();
    expect(screen.getByText(/Ảnh của lần xem thành công được lưu trên Cloudinary/i)).toBeInTheDocument();
    expect(screen.getByText(/Ảnh của lần xem bị từ chối hoặc lỗi không được lưu/i)).toBeInTheDocument();
    expect(screen.getByText(/xoá ảnh lòng bàn tay và ảnh đại diện của bạn/i)).toBeInTheDocument();

    // What is kept: hashes and anonymized GEM history, pointing to section 6 of /privacy
    expect(screen.getByText(/Mã băm của email, ID đăng nhập và định danh thiết bị/i)).toBeInTheDocument();
    expect(screen.getByText(/Lịch sử GEM:/i)).toBeInTheDocument();
    expect(
      within(container.querySelector("article") as HTMLElement).getByRole("link", { name: "Chính sách riêng tư" })
    ).toHaveAttribute("href", "/privacy");

    // The old, incorrect claims and internal ADR references must be gone
    expect(container).not.toHaveTextContent(/ADR-00/);
    expect(container).not.toHaveTextContent(/hoàn toàn không lưu trữ ảnh/i);
    expect(container).not.toHaveTextContent(/RAM/);

    // Warning when re-registering (0 GEM & cannot enter referral code)
    expect(
      screen.getByText(/tài khoản sẽ bắt đầu với 0 GEM/i)
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
    expect(screen.getByText(/Mỗi lượt luận giải chỉ tay tiêu tốn 5 GEM/i)).toBeInTheDocument();
  });

  it("should render the approved Privacy Policy (sections 1 to 8) when visiting /privacy", () => {
    const { container } = renderWithRouter("/privacy");

    expect(screen.getByRole("heading", { name: "Chính sách Quyền riêng tư PalmSight" })).toBeInTheDocument();
    expect(screen.getByText("Cập nhật: [ĐIỀN: ngày đăng]")).toBeInTheDocument();

    [
      "1. Giới thiệu",
      "2. Dữ liệu chúng tôi thu thập",
      "3. Mục đích sử dụng",
      "4. Bên thứ ba nhận dữ liệu",
      "5. Quảng cáo và lựa chọn của bạn",
      "6. Lưu trữ",
      "7. Quyền của bạn",
      "8. Điều khoản khác",
    ].forEach((title) => {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    });

    // Three tables (collected data, third parties, retention) with real content
    expect(screen.getAllByRole("table")).toHaveLength(3);
    expect(screen.getByText(/Ảnh bạn chụp hoặc chọn, ảnh đã vẽ đường chỉ tay/)).toBeInTheDocument();
    expect(screen.getByText("Cloudinary")).toBeInTheDocument();
    expect(screen.getByText("Lưu trên Cloudinary cho tới khi bạn xoá lần xem đó hoặc xoá tài khoản")).toBeInTheDocument();
    expect(screen.getByText("Giữ sau khi xoá tài khoản ở dạng ẩn danh để đối soát")).toBeInTheDocument();

    // Old incorrect claims and internal ADR references must be gone
    expect(container).not.toHaveTextContent(/ADR-00/);
    expect(container).not.toHaveTextContent(/hoàn toàn không lưu trữ ảnh/i);
    expect(container).not.toHaveTextContent(/Chính sách không lưu trữ ảnh lòng bàn tay/i);
    expect(container).not.toHaveTextContent(/nháp|Phụ lục cho chủ app|Ghi chú cho người duyệt/i);
  });

  it("should keep every owner placeholder in the Privacy Policy untouched", () => {
    const { container } = renderWithRouter("/privacy");
    const placeholders = (container.textContent ?? "").match(/\[(?:ĐIỀN|XÁC NHẬN):[^\]]*\]/g) ?? [];

    expect(placeholders).toEqual([
      "[ĐIỀN: ngày đăng]",
      "[ĐIỀN: tên cá nhân hoặc công ty vận hành, địa chỉ]",
      "[XÁC NHẬN: điều khoản của nhà cung cấp AI có cho phép dùng dữ liệu để huấn luyện mô hình không.]",
      "[ĐIỀN: nhà cung cấp email và hosting đang dùng, ví dụ Render, Vercel, MongoDB]",
      "[ĐIỀN: thời hạn theo yêu cầu kế toán và pháp lý]",
      "[XÁC NHẬN: thời hạn tối đa, hiện chưa có]",
      "[ĐIỀN: URL trang /data-deletion]",
      "[ĐIỀN: email hỗ trợ quyền riêng tư]",
      "[ĐIỀN: tên và địa chỉ người vận hành]",
    ]);
  });

  it("should switch tabs when clicking tab navigation links", () => {
    renderWithRouter("/data-deletion");

    expect(screen.getByRole("heading", { name: "Xoá dữ liệu của bạn" })).toBeInTheDocument();

    const termsTab = screen.getByRole("link", { name: "Điều khoản" });
    fireEvent.click(termsTab);

    expect(screen.getByRole("heading", { name: "Điều khoản dịch vụ" })).toBeInTheDocument();

    const privacyTab = screen.getByRole("link", { name: "Chính sách riêng tư" });
    fireEvent.click(privacyTab);

    expect(screen.getByRole("heading", { name: "Chính sách Quyền riêng tư PalmSight" })).toBeInTheDocument();
  });
});
