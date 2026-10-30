import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import PwaInstallButton from "./PwaInstallButton";

describe("PwaInstallButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
      })),
    });
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile",
      configurable: true,
    });
  });

  it("should not render button before beforeinstallprompt is fired on non-iOS", () => {
    render(<PwaInstallButton />);
    expect(screen.queryByTestId("pwa-install-button")).not.toBeInTheDocument();
  });

  it("should render button when beforeinstallprompt fires and trigger prompt on click", async () => {
    render(<PwaInstallButton />);

    const promptMock = vi.fn().mockResolvedValue(undefined);
    const installEvent = new Event("beforeinstallprompt");
    Object.assign(installEvent, {
      prompt: promptMock,
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });

    act(() => {
      window.dispatchEvent(installEvent);
    });

    const btn = screen.getByTestId("pwa-install-button");
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);

    await waitFor(() => {
      expect(promptMock).toHaveBeenCalledTimes(1);
    });
  });

  it("should show iOS install instructions when clicked on iPhone Safari", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });

    render(<PwaInstallButton />);

    const btn = screen.getByTestId("pwa-install-button");
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(screen.getByTestId("pwa-ios-guide")).toBeInTheDocument();
  });
});
