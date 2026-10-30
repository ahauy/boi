import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LoginPage from "./index";
import authService from "@/services/authService";
import { AuthenticationProvider } from "@/providers/AuthenticationProvider";
import BaseUrl from "@/consts/baseUrl";

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe("LoginPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedNavigate.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/login"]}>
          <AuthenticationProvider skipInitialRefresh>
            <LoginPage />
          </AuthenticationProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("should render Login form fields and actions", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: "Đăng nhập" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email hoặc username/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mật khẩu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Đăng nhập$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quên mật khẩu?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tạo tài khoản mới" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đăng nhập bằng Google/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đăng nhập bằng Facebook/ })).toBeInTheDocument();
  });

  it("should submit login form successfully and navigate to destination", async () => {
    vi.spyOn(authService, "postLogin").mockResolvedValue({
      accessToken: "mock-access-token",
      expiresIn: 900,
      isNewUser: false,
      user: {
        id: "123",
        displayName: "User One",
        username: "userone",
        avatarUrl: null,
        creditBalance: 3,
        referralCode: "ABCDEFGH",
      },
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText(/Email hoặc username/), {
      target: { value: "userone" },
    });
    fireEvent.change(screen.getByLabelText(/Mật khẩu/), {
      target: { value: "Password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Đăng nhập$/ }));

    await waitFor(() => {
      expect(authService.postLogin).toHaveBeenCalledWith({
        login: "userone",
        password: "Password123",
      });
      expect(mockedNavigate).toHaveBeenCalledWith(BaseUrl.Scan);
    });
  });
});
