import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Navbar from "./index";
import {
  AuthenticationProvider,
  useAuth,
} from "@/providers/AuthenticationProvider";
import authService from "@/services/authService";
import httpService from "@/services/httpService";

const AuthHelper = ({ shouldLogin }: { shouldLogin?: boolean }) => {
  const { setAuthSession } = useAuth();
  return (
    <button
      onClick={() => {
        if (shouldLogin) {
          setAuthSession({
            accessToken: "valid-token",
            user: {
              id: "u123",
              displayName: "Lê Văn C",
              username: "levanc",
              avatarUrl: null,
              creditBalance: 5,
              referralCode: "LEVC1234",
            },
          });
        }
      }}
    >
      Init Auth
    </button>
  );
};

describe("Navbar Component", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    httpService.setInMemoryToken(null);
    vi.restoreAllMocks();
  });

  const renderNavbar = (initialRoute = "/", loggedIn = false) => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthenticationProvider skipInitialRefresh>
          <AuthHelper shouldLogin={loggedIn} />
          <Navbar />
        </AuthenticationProvider>
      </MemoryRouter>
    );
  };

  it("should render with wide container and comfortable vertical padding", () => {
    const { container } = renderNavbar("/", false);
    const header = container.querySelector("header");
    expect(header).toHaveClass("min-h-[72px]");
    expect(header).toHaveClass("py-3.5");

    const innerDiv = header?.querySelector("div");
    expect(innerDiv).toHaveClass("max-w-[92%]");
    expect(innerDiv).toHaveClass("2xl:max-w-[1536px]");
  });

  it("should render ASCII wordmark linking to homepage", () => {
    renderNavbar("/login", false);

    const homeLink = screen.getByRole("link", { name: "PALMSIGHT Home" });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("should display 'Đăng ký' link when unauthenticated on /login", () => {
    renderNavbar("/login", false);

    const registerLink = screen.getByRole("link", { name: "Đăng ký" });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute("href", "/register");
  });

  it("should display 'Đăng nhập' link when unauthenticated on any other page", () => {
    renderNavbar("/register", false);

    const loginLink = screen.getByRole("link", { name: "Đăng nhập" });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("should display both 'Đăng nhập' link and 'Bắt đầu' CTA button when unauthenticated on homepage", () => {
    renderNavbar("/", false);

    const loginLink = screen.getByRole("link", { name: "Đăng nhập" });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
    expect(loginLink).toHaveClass("text-mute");

    const startButton = screen.getByRole("link", { name: "Bắt đầu" });
    expect(startButton).toBeInTheDocument();
    expect(startButton).toHaveAttribute("href", "/scan");
    expect(startButton).toHaveClass("btn-primary");
  });

  it("should display nav links, credits badge, and user menu when authenticated", async () => {
    renderNavbar("/", true);

    await act(async () => {
      screen.getByText("Init Auth").click();
    });

    expect(screen.getByRole("link", { name: "Xem bói" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lịch sử" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tài khoản" })).toBeInTheDocument();

    const creditBadge = screen.getByTestId("credit-balance-badge");
    expect(creditBadge).toHaveTextContent("[5 CREDITS]");

    const userMenuButton = screen.getByRole("button", { name: "User menu" });
    expect(userMenuButton).toHaveTextContent("L");

    // Click user avatar to open popover
    fireEvent.click(userMenuButton);

    expect(screen.getByText("Lê Văn C")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Đổi mật khẩu" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Đăng xuất" })
    ).toBeInTheDocument();
  });

  it("should handle logout from popover menu", async () => {
    vi.spyOn(authService, "postLogout").mockResolvedValue(undefined);

    renderNavbar("/", true);

    await act(async () => {
      screen.getByText("Init Auth").click();
    });

    const userMenuButton = screen.getByRole("button", { name: "User menu" });
    fireEvent.click(userMenuButton);

    const logoutButton = screen.getByRole("button", { name: "Đăng xuất" });
    await act(async () => {
      fireEvent.click(logoutButton);
    });

    expect(authService.postLogout).toHaveBeenCalled();
  });

  it("should render placeholder and not flash unauthenticated buttons when loading and !user", () => {
    vi.spyOn(authService, "postRefresh").mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthenticationProvider>
          <Navbar />
        </AuthenticationProvider>
      </MemoryRouter>
    );

    // Active loading indicator skeleton should be rendered
    expect(screen.getByLabelText("Đang tải...")).toBeInTheDocument();

    // Unauthenticated button "Bắt đầu" and "Đăng nhập" should NOT be rendered while loading and no cached user
    expect(
      screen.queryByRole("link", { name: "Đăng nhập" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Bắt đầu" })
    ).not.toBeInTheDocument();
  });

  it("should render authenticated navbar immediately when user is in storage during initial load", () => {
    httpService.saveUserStorage({
      id: "u-storage",
      displayName: "Hydrated User",
      username: "hydrated",
      avatarUrl: null,
      creditBalance: 7,
      referralCode: "HYDRATE7",
    });
    vi.spyOn(authService, "postRefresh").mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthenticationProvider>
          <Navbar />
        </AuthenticationProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Xem bói" })).toBeInTheDocument();
    expect(screen.getByTestId("credit-balance-badge")).toHaveTextContent(
      "[7 CREDITS]"
    );
    expect(
      screen.getByRole("button", { name: "User menu" })
    ).toBeInTheDocument();
  });
});
