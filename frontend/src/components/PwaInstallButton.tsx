import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const isStandaloneDisplayMode = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const matchStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true;
  return Boolean(matchStandalone || iosStandalone);
};

const isIosDevice = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
};

export const PwaInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() =>
    isStandaloneDisplayMode()
  );
  const [isIos] = useState<boolean>(() => isIosDevice());
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  useEffect(() => {
    if (isInstalled) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowIosGuide(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isInstalled]);

  if (isInstalled || (!deferredPrompt && !isIos)) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
      return;
    }

    if (isIos) {
      setShowIosGuide((prev) => !prev);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleInstallClick}
        data-testid="pwa-install-button"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#d4af37]/40 bg-[#1a1030]/80 text-[#f7e7b4] hover:border-[#d4af37] hover:bg-[#d4af37]/15 text-xs font-medium transition-colors cursor-pointer"
      >
        <Download aria-hidden="true" className="h-3.5 w-3.5 text-[#d4af37]" />
        <span>Cài đặt ứng dụng</span>
      </button>

      {showIosGuide && (
        <div
          role="dialog"
          aria-label="Hướng dẫn cài đặt ứng dụng trên iOS"
          data-testid="pwa-ios-guide"
          className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 w-72 p-3.5 rounded-xl border border-[#d4af37]/50 bg-[#140c29] text-ink shadow-xl z-50 text-xs leading-relaxed"
        >
          <div className="flex items-center justify-between mb-1.5 text-[#f7e7b4] font-semibold">
            <span>✦ Thêm vào màn hình chính</span>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              aria-label="Đóng hướng dẫn"
              className="text-mute hover:text-[#f7e7b4] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="m-0 text-body">
            Nhấn nút <strong className="text-[#f7e7b4]">Chia sẻ</strong> trên
            thanh trình duyệt, sau đó chọn{" "}
            <strong className="text-[#f7e7b4]">Thêm vào MH chính</strong>.
          </p>
        </div>
      )}
    </div>
  );
};

export default PwaInstallButton;
