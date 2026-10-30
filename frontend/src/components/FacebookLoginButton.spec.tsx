import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FacebookLoginButton from "./FacebookLoginButton";
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

describe("FacebookLoginButton", () => {
  const initMock = vi.fn();
  const loginMock = vi.fn();

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AuthenticationProvider skipInitialRefresh>
          <FacebookLoginButton />
        </AuthenticationProvider>
      </MemoryRouter>
    );

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedNavigate.mockReset();
    initMock.mockClear();
    loginMock.mockClear();
    vi.stubEnv("VITE_FACEBOOK_APP_ID", "test-fb-app-id");
    window.FB = {
      init: initMock,
      login: loginMock,
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.FB;
  });

  it("initializes the Facebook SDK with the configured App ID and enables the button", async () => {
    renderComponent();

    await waitFor(() => expect(initMock).toHaveBeenCalledTimes(1));
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({ appId: "test-fb-app-id", version: "v19.0" })
    );
    expect(screen.getByRole("button", { name: /Đăng nhập bằng Facebook/ })).not.toBeDisabled();
  });

  it("sends the Facebook accessToken to the API and routes a new user to referral entry", async () => {
    loginMock.mockImplementation((callback: (res: FacebookLoginStatusResponse) => void) => {
      callback({
        status: "connected",
        authResponse: {
          accessToken: "fb-access-token-123",
          userID: "fb-user-1",
          expiresIn: 3600,
          signedRequest: "signed",
        },
      });
    });

    vi.spyOn(authService, "postFacebookLogin").mockResolvedValue({
      accessToken: "jwt-access-token",
      expiresIn: 900,
      isNewUser: true,
      user: {
        id: "u-fb-1",
        displayName: "Facebook User",
        username: null,
        avatarUrl: null,
        creditBalance: 3,
        referralCode: "FBCODE12",
      },
    });

    renderComponent();
    const button = screen.getByRole("button", { name: /Đăng nhập bằng Facebook/ });
    await waitFor(() => expect(button).not.toBeDisabled());

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(expect.any(Function), {
        scope: "public_profile,email",
        auth_type: "rerequest",
      });
      expect(authService.postFacebookLogin).toHaveBeenCalledWith({
        accessToken: "fb-access-token-123",
      });
      expect(mockedNavigate).toHaveBeenCalledWith(BaseUrl.ReferralEnter);
    });
  });

  it("shows a disabled button when no VITE_FACEBOOK_APP_ID is configured", () => {
    vi.stubEnv("VITE_FACEBOOK_APP_ID", "");
    renderComponent();

    expect(screen.getByRole("button", { name: /Đăng nhập bằng Facebook/ })).toBeDisabled();
    expect(initMock).not.toHaveBeenCalled();
  });

  it("opens the Facebook OAuth dialog popup when window.FB is not loaded and submits token via postMessage", async () => {
    delete window.FB;
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => node);
    const openSpy = vi.spyOn(window, "open").mockReturnValue({
      closed: false,
      close: vi.fn(),
      location: { origin: "https://www.facebook.com", hash: "", search: "" },
    } as unknown as Window);

    vi.spyOn(authService, "postFacebookLogin").mockResolvedValue({
      accessToken: "jwt-from-oauth",
      expiresIn: 900,
      isNewUser: false,
      user: {
        id: "u-fb-2",
        displayName: "OAuth FB User",
        username: "oauthfb",
        avatarUrl: null,
        creditBalance: 5,
        referralCode: "FBOAUTH1",
      },
    });

    renderComponent();
    const button = screen.getByRole("button", { name: /Đăng nhập bằng Facebook/ });
    expect(button).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(button);
    });

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://www.facebook.com/v19.0/dialog/oauth?client_id=test-fb-app-id"),
      "facebook-oauth-login",
      expect.any(String)
    );

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          data: {
            type: "PALMSIGHT_FB_OAUTH_RESULT",
            accessToken: "oauth-popup-token-456",
          },
        })
      );
    });

    await waitFor(() => {
      expect(authService.postFacebookLogin).toHaveBeenCalledWith({
        accessToken: "oauth-popup-token-456",
      });
      expect(mockedNavigate).toHaveBeenCalledWith(BaseUrl.Scan);
    });
  });
});
