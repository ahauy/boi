import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import * as AuthProviderModule from "@/providers/AuthenticationProvider";

vi.mock("@/providers/AuthenticationProvider", () => ({
  useAuth: vi.fn(),
}));

const LoginPageMock = () => {
  const location = useLocation();
  const state = location.state as { from?: { pathname: string } } | undefined;
  return (
    <div>
      <div data-testid="login-page">Login Page</div>
      <div data-testid="redirect-from">{state?.from?.pathname || "none"}</div>
    </div>
  );
};

describe("PrivateRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPrivateRoute = (initialEntry = "/dashboard", childrenNode = <div data-testid="protected-content">Secret Dashboard</div>) => {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                {childrenNode}
              </PrivateRoute>
            }
          />
          <Route
            path="/readings/:id"
            element={
              <PrivateRoute>
                <div data-testid="protected-reading">Reading Details</div>
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<LoginPageMock />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("should show loading indicator and not render children when auth.loading is true", () => {
    vi.mocked(AuthProviderModule.useAuth).mockReturnValue({
      loading: true,
      isLogged: false,
      accessToken: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setAuthSession: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
    });

    const { container } = renderPrivateRoute();

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should render children immediately without loading indicator when auth.loading is true and auth.isLogged is true (optimistic session)", () => {
    vi.mocked(AuthProviderModule.useAuth).mockReturnValue({
      loading: true,
      isLogged: true,
      accessToken: null,
      user: {
        id: "1",
        displayName: "User",
        username: "user",
        avatarUrl: null,
        creditBalance: 10,
        referralCode: "REF123",
      },
      login: vi.fn(),
      logout: vi.fn(),
      setAuthSession: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
    });

    const { container } = renderPrivateRoute();

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("should render children when auth.loading is false and auth.isLogged is true", () => {
    vi.mocked(AuthProviderModule.useAuth).mockReturnValue({
      loading: false,
      isLogged: true,
      accessToken: "mock-access-token",
      user: {
        id: "1",
        displayName: "User",
        username: "user",
        avatarUrl: null,
        creditBalance: 10,
        referralCode: "REF123",
      },
      login: vi.fn(),
      logout: vi.fn(),
      setAuthSession: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
    });

    const { container } = renderPrivateRoute();

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("should redirect to login when auth.loading is false and auth.isLogged is false, preserving location in state", () => {
    vi.mocked(AuthProviderModule.useAuth).mockReturnValue({
      loading: false,
      isLogged: false,
      accessToken: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setAuthSession: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
    });

    const { container } = renderPrivateRoute("/dashboard");

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.getByTestId("redirect-from").textContent).toBe("/dashboard");
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("should preserve deep link location in state when redirected to login", () => {
    vi.mocked(AuthProviderModule.useAuth).mockReturnValue({
      loading: false,
      isLogged: false,
      accessToken: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      setAuthSession: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
    });

    renderPrivateRoute("/readings/reading-999");

    expect(screen.queryByTestId("protected-reading")).not.toBeInTheDocument();
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.getByTestId("redirect-from").textContent).toBe("/readings/reading-999");
  });
});
