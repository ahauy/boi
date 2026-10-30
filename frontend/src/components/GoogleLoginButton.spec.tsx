import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GoogleLoginButton from "./GoogleLoginButton";
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

describe("GoogleLoginButton", () => {
  let codeCallback: ((response: GoogleCodeResponse) => void) | undefined;
  let errorCallback: ((error: { type: string }) => void) | undefined;
  const requestCode = vi.fn();
  const initCodeClient = vi.fn((config: GoogleCodeClientConfig) => {
    codeCallback = config.callback;
    errorCallback = config.error_callback;
    return { requestCode };
  });

  const renderComponent = (initialEntries = ["/"]) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <AuthenticationProvider skipInitialRefresh>
          <GoogleLoginButton />
        </AuthenticationProvider>
      </MemoryRouter>
    );

  const getButton = () => screen.getByRole("button", { name: /Đăng nhập bằng Google/ });

  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockedNavigate.mockReset();
    initCodeClient.mockClear();
    requestCode.mockClear();
    codeCallback = undefined;
    errorCallback = undefined;
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    window.google = {
      accounts: {
        id: { initialize: vi.fn(), renderButton: vi.fn(), disableAutoSelect: vi.fn() },
        oauth2: { initCodeClient },
      },
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.google;
  });

  it("opens the Google code popup from the custom styled button", async () => {
    renderComponent();

    await waitFor(() => expect(getButton()).toBeEnabled());
    expect(initCodeClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "test-client-id.apps.googleusercontent.com",
        scope: "openid email profile",
        ux_mode: "popup",
      })
    );
    expect(getButton()).toHaveClass("btn-secondary");

    fireEvent.click(getButton());
    expect(requestCode).toHaveBeenCalledTimes(1);
  });

  it("sends the authorization code to the API and routes a new user to referral entry", async () => {
    vi.spyOn(authService, "postGoogleLogin").mockResolvedValue({
      accessToken: "access-token",
      expiresIn: 900,
      isNewUser: true,
      user: {
        id: "u1",
        displayName: "Google User",
        username: null,
        avatarUrl: null,
        creditBalance: 3,
        referralCode: "ABCDEFGH",
      },
    });

    renderComponent();
    await waitFor(() => expect(getButton()).toBeEnabled());
    fireEvent.click(getButton());

    await act(async () => {
      codeCallback?.({ code: "google-auth-code" });
    });

    await waitFor(() => {
      expect(authService.postGoogleLogin).toHaveBeenCalledWith({ code: "google-auth-code" });
      expect(mockedNavigate).toHaveBeenCalledWith(BaseUrl.ReferralEnter);
    });
  });

  it("sends claimToken from sessionStorage and redirects to claimed reading on success", async () => {
    sessionStorage.setItem("ps_claim_token", "claim-token-xyz");
    vi.spyOn(authService, "postGoogleLogin").mockResolvedValue({
      accessToken: "access-token",
      expiresIn: 900,
      isNewUser: true,
      user: {
        id: "u1",
        displayName: "Google User",
        username: null,
        avatarUrl: null,
        creditBalance: 2,
        referralCode: "ABCDEFGH",
      },
      claimedReadingId: "claimed-reading-123",
    });

    renderComponent();
    await waitFor(() => expect(getButton()).toBeEnabled());
    fireEvent.click(getButton());

    await act(async () => {
      codeCallback?.({ code: "google-auth-code" });
    });

    await waitFor(() => {
      expect(authService.postGoogleLogin).toHaveBeenCalledWith({
        code: "google-auth-code",
        claimToken: "claim-token-xyz",
      });
      expect(mockedNavigate).toHaveBeenCalledWith("/readings/claimed-reading-123");
      expect(sessionStorage.getItem("ps_claim_token")).toBeNull();
    });
  });

  it("sends claimToken from URL query when present", async () => {
    vi.spyOn(authService, "postGoogleLogin").mockResolvedValue({
      accessToken: "access-token",
      expiresIn: 900,
      isNewUser: false,
      user: {
        id: "u1",
        displayName: "Google User",
        username: "googleuser",
        avatarUrl: null,
        creditBalance: 3,
        referralCode: "ABCDEFGH",
      },
    });

    renderComponent(["/login?claimToken=query-claim-token"]);
    await waitFor(() => expect(getButton()).toBeEnabled());
    fireEvent.click(getButton());

    await act(async () => {
      codeCallback?.({ code: "google-auth-code" });
    });

    await waitFor(() => {
      expect(authService.postGoogleLogin).toHaveBeenCalledWith({
        code: "google-auth-code",
        claimToken: "query-claim-token",
      });
      expect(mockedNavigate).toHaveBeenCalledWith(BaseUrl.Scan);
    });
  });

  it("re-enables the button when the user closes the popup", async () => {
    renderComponent();
    await waitFor(() => expect(getButton()).toBeEnabled());

    fireEvent.click(getButton());
    expect(screen.getByRole("button", { name: /Đang đăng nhập bằng Google/ })).toBeDisabled();

    act(() => {
      errorCallback?.({ type: "popup_closed" });
    });
    expect(getButton()).toBeEnabled();
  });

  it("shows a disabled fallback when no client ID is configured", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    renderComponent();

    expect(getButton()).toBeDisabled();
    expect(initCodeClient).not.toHaveBeenCalled();
  });
});
