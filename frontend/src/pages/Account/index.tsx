import { useState, useEffect, useRef } from "react";
import PageWrapper from "@/components/PageWrapper";
import useMeQuery from "./hooks/useMeQuery";
import ProfileSection from "./components/ProfileSection";
import SecuritySection from "./components/SecuritySection";
import EnterReferralSection from "./components/EnterReferralSection";
import WalletSection from "./components/WalletSection";
import ReferralSection from "./components/ReferralSection";
import type { UserDto } from "./types";

interface NavItem {
  id: string;
  label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: "ho-so", label: "Hồ sơ" },
  { id: "bao-mat", label: "Bảo mật" },
  { id: "nhap-ma", label: "Nhập mã" },
  { id: "vi-credits", label: "Ví credits" },
  { id: "gioi-thieu", label: "Giới thiệu" },
];

export const Account = () => {
  const { data: meData, isLoading, isError, refetch } = useMeQuery();
  const user = (meData || null) as UserDto | null;
  const [activeSection, setActiveSection] = useState<string>("ho-so");
  const isManualScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initialHash = window.location.hash.replace("#", "");
    if (NAV_ITEMS.some((item) => item.id === initialHash)) {
      setActiveSection(initialHash);
    }

    const handleScroll = () => {
      if (isManualScrollRef.current) return;

      const isAtBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 60;

      if (isAtBottom) {
        setActiveSection(NAV_ITEMS[NAV_ITEMS.length - 1].id);
        return;
      }

      let current = "";
      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 180) {
            current = item.id;
          }
        }
      }
      if (current) {
        setActiveSection(current);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleNavClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    isManualScrollRef.current = true;
    setActiveSection(id);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isManualScrollRef.current = false;
    }, 800);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView?.({ behavior: "smooth" });
      }
    }
  };

  return (
    <PageWrapper>
      <div className="component:Account w-full max-w-[1000px] mx-auto pt-8 md:pt-12 pb-36 md:pb-48 px-4 font-sans text-ink">
        <div className="flex flex-col md:flex-row items-start">
          <aside className="w-full md:w-[220px] shrink-0 sticky top-[72px] md:top-24 z-30 self-start mb-6 md:mb-0 bg-canvas/90 md:bg-transparent backdrop-blur-md md:backdrop-blur-none py-2 md:py-0">
            <div className="hidden md:flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-gold-dim mb-4 px-2">
              <span>✦</span>
              <span>Định Danh Chiêm Tinh</span>
            </div>
            <nav
              id="sub-nav"
              aria-label="Sub navigation"
              className="flex flex-row md:flex-col gap-3 md:gap-1 text-sm overflow-x-auto no-scrollbar pb-2 md:pb-0 p-1.5 rounded-xl bg-surface-soft/50 border border-gold/15 backdrop-blur-md"
            >
              {NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <div key={item.id} className="shrink-0">
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => handleNavClick(item.id, e)}
                      data-testid={`sub-nav-${item.id}`}
                      aria-current={isActive ? "true" : undefined}
                      className={`sub-nav-link flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer select-none whitespace-nowrap ${
                        isActive
                          ? "font-bold text-ink bg-gold/15 border-b-2 border-ink shadow-gold-glow"
                          : "text-mute hover:text-gold-light hover:bg-surface-card/60 border-b-2 border-transparent"
                      }`}
                    >
                      <span className="text-[10px] text-gold/70">✦</span>
                      <span>{item.label}</span>
                    </a>
                  </div>
                );
              })}
            </nav>
          </aside>

          <div
            aria-hidden="true"
            className="hidden md:block w-px bg-gradient-to-b from-transparent via-gold/25 to-transparent self-stretch shrink-0 mx-8"
          />

          <div className="w-full md:max-w-[700px] shrink-0 flex flex-col">
            {isError && !user ? (
              <div
                role="alert"
                className="p-5 border border-terminal-danger/50 bg-error-container/30 rounded-xl text-sm text-ink flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <span>
                  <span className="font-bold text-terminal-danger mr-2">[!]</span>
                  Không tải được thông tin tài khoản.
                </span>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="btn-secondary h-8 px-3 text-xs self-start sm:self-auto"
                >
                  Thử lại
                </button>
              </div>
            ) : isLoading || !user ? (
              <div className="p-10 mystic-card rounded-2xl text-center text-sm text-mute font-mono">
                Đang tải thông tin tài khoản...
              </div>
            ) : (
              <>
                <ProfileSection user={user} />
                <SecuritySection user={user} />
                <EnterReferralSection user={user} />
                <WalletSection user={user} />
                <ReferralSection user={user} />
              </>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Account;
