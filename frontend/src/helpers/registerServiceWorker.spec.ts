import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerServiceWorker } from "./registerServiceWorker";

describe("registerServiceWorker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should register /sw.js immediately when document.readyState is complete", () => {
    const registerMock = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: registerMock },
      configurable: true,
    });
    Object.defineProperty(document, "readyState", {
      value: "complete",
      configurable: true,
    });

    registerServiceWorker();

    expect(registerMock).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("should wait for window load event when document.readyState is loading", () => {
    const registerMock = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: registerMock },
      configurable: true,
    });
    Object.defineProperty(document, "readyState", {
      value: "loading",
      configurable: true,
    });

    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    registerServiceWorker();

    expect(registerMock).not.toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "load",
      expect.any(Function),
      { once: true }
    );
  });
});
