import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Homepage from "./index";
import {
  AuthenticationProvider,
  useAuth,
} from "@/providers/AuthenticationProvider";

const AuthSetter = ({ isLogged }: { isLogged?: boolean }) => {
  const { setAuthSession } = useAuth();
  return (
    <button
      data-testid="auth-setter"
      onClick={() => {
        if (isLogged) {
          setAuthSession({
            accessToken: "mock-token",
            user: {
              id: "user-1",
              displayName: "Test User",
              username: "testuser",
              avatarUrl: null,
              creditBalance: 3,
              referralCode: "TEST1234",
            },
          });
        }
      }}
    >
      Set Auth
    </button>
  );
};

describe("Homepage (Landing Page)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const renderHomepage = (initialEntries = ["/"], loggedIn = false) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <AuthenticationProvider skipInitialRefresh>
          <AuthSetter isLogged={loggedIn} />
          <Homepage />
        </AuthenticationProvider>
      </MemoryRouter>
    );
  };

  it("should render HeroSection with badge, H1, description, notes, and TUI mockup", () => {
    renderHomepage();

    // Badge
    expect(screen.getByText("Miễn phí 3 credits")).toBeInTheDocument();

    // H1
    expect(
      screen.getByRole("heading", {
        name: "Chụp lòng bàn tay. AI đọc chỉ tay giúp bạn.",
        level: 1,
      })
    ).toBeInTheDocument();

    // Description
    expect(
      screen.getByText(
        "Chọn phương Tây, phương Đông hoặc Ấn Độ, chụp một tấm ảnh và nhận bài bói trong chưa đầy một phút."
      )
    ).toBeInTheDocument();

    // Caption note
    expect(
      screen.getByText("Đăng nhập bằng Google hoặc Facebook.")
    ).toBeInTheDocument();

    // Prompt row in TUI Mockup
    expect(
      screen.getByText(/Phương Đông\s+Tay trái\s+\[Bói toàn bộ\]/)
    ).toBeInTheDocument();

    // Shortcut hints
    expect(
      screen.getByText("tab đổi trường phái enter xem bói")
    ).toBeInTheDocument();
  });

  it("should route 'Bắt đầu xem bói' to /login when unauthenticated, and /scan when authenticated", async () => {
    const { unmount } = renderHomepage(["/"], false);

    // Unauthenticated: Both CTA buttons (Hero and Bottom CTA) link to /login
    const ctaLinksUnauth = screen.getAllByRole("link", {
      name: "Bắt đầu xem bói",
    });
    expect(ctaLinksUnauth.length).toBe(2);
    ctaLinksUnauth.forEach((link) => {
      expect(link).toHaveAttribute("href", "/login");
    });

    unmount();

    // Authenticated
    renderHomepage(["/"], true);
    await act(async () => {
      screen.getByTestId("auth-setter").click();
    });

    const ctaLinksAuth = screen.getAllByRole("link", {
      name: "Bắt đầu xem bói",
    });
    expect(ctaLinksAuth.length).toBe(2);
    ctaLinksAuth.forEach((link) => {
      expect(link).toHaveAttribute("href", "/scan");
    });
  });

  it("should handle 'Xem ví dụ kết quả' anchor click and smooth scroll", () => {
    renderHomepage();

    const sampleBtn = screen.getByRole("link", { name: "Xem ví dụ kết quả" });
    expect(sampleBtn).toHaveAttribute("href", "#vi-du-ket-qua");

    fireEvent.click(sampleBtn);
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
    });
  });

  it("should render HowItWorksSection with 3 steps and [+] markers", () => {
    renderHomepage();

    expect(
      screen.getByRole("heading", { name: "Cách hoạt động", level: 2 })
    ).toBeInTheDocument();

    expect(screen.getByText("[+] Chọn trường phái")).toBeInTheDocument();
    expect(
      screen.getByText("Phương Tây, phương Đông hoặc Ấn Độ.")
    ).toBeInTheDocument();

    expect(screen.getByText("[+] Chụp lòng bàn tay")).toBeInTheDocument();
    expect(screen.getByText("Bằng camera hoặc ảnh có sẵn.")).toBeInTheDocument();

    expect(screen.getByText("[+] Nhận bài bói")).toBeInTheDocument();
    expect(
      screen.getByText("Quan sát, ý nghĩa và lời khuyên.")
    ).toBeInTheDocument();
  });

  it("should render SchoolsSection with 3 schools and their characteristics", () => {
    renderHomepage();

    const schoolsHeading = screen.getByRole("heading", {
      name: "Trường phái",
      level: 2,
    });
    const schoolsSection = schoolsHeading.closest("section");
    expect(schoolsSection).not.toBeNull();
    if (!schoolsSection) {
      throw new Error("Schools section not found");
    }

    // West
    expect(
      within(schoolsSection).getByText("Chỉ tay phương Tây")
    ).toBeInTheDocument();
    expect(
      within(schoolsSection).getByText(
        "Dáng tay 4 nguyên tố, các đường chỉ chính và 7 gò"
      )
    ).toBeInTheDocument();
    expect(
      within(schoolsSection).getByText(
        "Tình cảm · Trí tuệ · Sinh mệnh · Định mệnh · Danh vọng"
      )
    ).toBeInTheDocument();

    // East
    expect(
      within(schoolsSection).getByText("Chỉ tay phương Đông")
    ).toBeInTheDocument();
    expect(
      within(schoolsSection).getByText(
        "Dáng tay ngũ hành, Thiên – Nhân – Địa văn, cung bát quái"
      )
    ).toBeInTheDocument();
    expect(
      within(schoolsSection).getByText(
        "Ngũ hành · Thiên văn · Nhân văn · Địa văn · Bát quái · Các ngón tay"
      )
    ).toBeInTheDocument();

    // India
    expect(
      within(schoolsSection).getByText("Chỉ tay Ấn Độ")
    ).toBeInTheDocument();
    expect(
      within(schoolsSection).getByText(
        "Gò theo 9 hành tinh, đường chính, dấu hiệu đặc biệt"
      )
    ).toBeInTheDocument();
    expect(
      within(schoolsSection).getByText(
        "9 hành tinh · Đường chính · Dấu hiệu đặc biệt · Ngón cái"
      )
    ).toBeInTheDocument();
  });

  it("should render SampleResultSection with terminal man-page formatting", () => {
    renderHomepage();

    expect(
      screen.getByRole("heading", { name: "Ví dụ kết quả", level: 2 })
    ).toBeInTheDocument();

    expect(screen.getByText("PALMSIGHT(1)")).toBeInTheDocument();
    expect(screen.getByText("Tay trái")).toBeInTheDocument();

    expect(screen.getByText("Tóm tắt:")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tay Thổ, thực tế và đáng tin cậy. Tình cảm chân thành, chậm mà chắc."
      )
    ).toBeInTheDocument();

    expect(screen.getByText("Dáng tay ngũ hành")).toBeInTheDocument();
    expect(screen.getByText("[+] Quan sát")).toBeInTheDocument();
    expect(
      screen.getByText("Lòng bàn tay vuông, ngón ngắn và chắc.")
    ).toBeInTheDocument();

    expect(screen.getByText("[+] Ý nghĩa")).toBeInTheDocument();
    expect(
      screen.getByText("Tay Thổ: thực tế, đáng tin cậy, làm việc đâu ra đó.")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Ví dụ minh hoạ, không phải kết quả thật.")
    ).toBeInTheDocument();
  });

  it("should render CreditsSection with credit mechanics", () => {
    renderHomepage();

    expect(
      screen.getByRole("heading", { name: "Credits", level: 2 })
    ).toBeInTheDocument();

    expect(screen.getByText("[+] 3 credits")).toBeInTheDocument();
    expect(screen.getByText("[+] +2 credits")).toBeInTheDocument();
    expect(screen.getByText("[+] 1 lần xem = 1 credit")).toBeInTheDocument();
  });

  it("should render FaqSection and handle accordion open/close interactions", () => {
    renderHomepage();

    expect(
      screen.getByRole("heading", { name: "Hỏi đáp", level: 2 })
    ).toBeInTheDocument();

    // Check all questions exist
    const q1Button = screen.getByRole("button", {
      name: /Ảnh của tôi có được lưu không\?/,
    });
    const q2Button = screen.getByRole("button", {
      name: /Kết quả có chính xác không\?/,
    });
    const q3Button = screen.getByRole("button", {
      name: /Nếu AI bị lỗi thì sao\?/,
    });

    expect(q1Button).toBeInTheDocument();
    expect(q2Button).toBeInTheDocument();
    expect(q3Button).toBeInTheDocument();

    // Question 1 answer should be open initially (per screen.html)
    expect(screen.getByTestId("faq-answer-0")).toBeInTheDocument();
    expect(
      screen.getByText(/Máy chủ xử lý ảnh tạm thời trên RAM để phân tích AI và không lưu trữ trên máy chủ hay dịch vụ đám mây nào theo ADR-0010/)
    ).toBeInTheDocument();

    // Questions 2 & 3 answers should be closed initially
    expect(screen.queryByTestId("faq-answer-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("faq-answer-2")).not.toBeInTheDocument();

    // Toggle Question 2 -> open
    fireEvent.click(q2Button);
    expect(screen.getByTestId("faq-answer-1")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Kết quả mang tính chiêm đoán giải trí và tham khảo dựa trên cổ thư kết hợp AI Vision."
      )
    ).toBeInTheDocument();

    // Toggle Question 1 -> close
    fireEvent.click(q1Button);
    expect(screen.queryByTestId("faq-answer-0")).not.toBeInTheDocument();

    // Toggle Question 3 -> open
    fireEvent.click(q3Button);
    expect(screen.getByTestId("faq-answer-2")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Hệ thống tự động hoàn trả 1 credit vào ví của bạn nếu ảnh không đạt yêu cầu hoặc xảy ra lỗi."
      )
    ).toBeInTheDocument();
  });

  it("should trigger smooth scroll when initial URL has hash", () => {
    renderHomepage(["/#cach-hoat-dong"]);
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
    });
  });

  it("should display Terminal Minimalist guest trial CTA linking to /scan when unauthenticated", async () => {
    const { unmount } = renderHomepage(["/"], false);

    const guestCtas = screen.getAllByRole("link", {
      name: /Bói thử 1 lần/,
    });
    expect(guestCtas.length).toBeGreaterThan(0);
    guestCtas.forEach((link) => {
      expect(link).toHaveAttribute("href", "/scan");
    });

    unmount();

    // When logged in, guest trial CTA should not appear
    renderHomepage(["/"], true);
    await act(async () => {
      screen.getByTestId("auth-setter").click();
    });

    expect(
      screen.queryByRole("link", {
        name: /Bói thử 1 lần/,
      })
    ).not.toBeInTheDocument();
  });
});
