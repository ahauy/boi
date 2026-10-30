import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sparkles,
  ScrollText,
  User,
  Wallet,
  Gift,
  KeyRound,
  LogOut,
  Hand,
} from "lucide-react";
import BaseUrl from "@/consts/baseUrl";
import { useAuth } from "@/providers/AuthenticationProvider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ASCII_WORDMARK = `███ ███ █   █ █ ███ ███ ███ █ █ ███
█ █ █ █ █   ███ █    █  █   █ █  █
███ ███ █   ███ ███  █  █ █ ███  █
█   █ █ █   █ █   █  █  █ █ █ █  █
█   █ █ ███ █ █ ███ ███ ███ █ █  █`;

interface NavbarProps {
  rightAction?: "login" | "user" | "none";
}

export default function Navbar({ rightAction }: NavbarProps) {
  const { isLogged, user, logout, loading } = useAuth();
  const location = useLocation();
  const [openPopover, setPopover] = useState(false);

  const isLoginPage = location.pathname === BaseUrl.Login;

  return (
    <header className="sticky left-0 right-0 top-0 z-50 flex min-h-[72px] w-full items-center border-b border-hairline bg-[#0b0716]/85 backdrop-blur-xl py-3.5 text-ink sm:py-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="mx-auto flex w-full max-w-[92%] items-center justify-between px-4 sm:px-6 2xl:max-w-[1536px]">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link
            to={BaseUrl.Homepage}
            aria-label="PALMSIGHT Home"
            className="group flex select-none items-center gap-3 py-0.5"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#d4af37]/60 bg-gradient-to-br from-[#2c1d4f] to-[#140d26] shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-transform duration-300 group-hover:scale-105">
              <Hand className="h-5 w-5 text-[#f5d77f]" />
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#d4af37] text-[8px] text-[#0b0716] font-bold"
              >
                ✦
              </span>
            </div>

            <div className="flex flex-col">
              <span className="font-display text-xl sm:text-2xl font-bold tracking-[0.14em] text-gold-gradient leading-none">
                PALMSIGHT
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-mute mt-0.5 hidden sm:inline">
                Huyền Cơ Chỉ Tay
              </span>
              <pre
                className="sr-only select-none whitespace-pre font-mono text-[7px] font-bold leading-[1.05] tracking-normal text-ink"
                aria-label="PALMSIGHT"
              >
                {ASCII_WORDMARK}
              </pre>
            </div>
          </Link>

          {isLogged ? (
            <nav className="hidden items-center gap-2 text-sm sm:flex md:gap-4">
              <Link
                to={BaseUrl.Scan}
                className={`inline-flex items-center gap-1.5 border-b-2 px-2 py-1.5 transition-all ${
                  location.pathname === BaseUrl.Scan
                    ? "border-[#d4af37] font-semibold text-[#f7e7b4] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
                    : "border-transparent text-mute hover:text-ink"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-[#d4af37]" />
                <span>Xem bói</span>
              </Link>
              <Link
                to={BaseUrl.Readings}
                className={`inline-flex items-center gap-1.5 border-b-2 px-2 py-1.5 transition-all ${
                  location.pathname === BaseUrl.Readings ||
                  location.pathname.startsWith("/readings")
                    ? "border-[#d4af37] font-semibold text-[#f7e7b4] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
                    : "border-transparent text-mute hover:text-ink"
                }`}
              >
                <ScrollText className="h-3.5 w-3.5 text-[#a855f7]" />
                <span>Lịch sử</span>
              </Link>
              <Link
                to={BaseUrl.Account}
                className={`inline-flex items-center gap-1.5 border-b-2 px-2 py-1.5 transition-all ${
                  location.pathname === BaseUrl.Account ||
                  location.pathname === BaseUrl.ChangePassword
                    ? "border-[#d4af37] font-semibold text-[#f7e7b4] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
                    : "border-transparent text-mute hover:text-ink"
                }`}
              >
                <User className="h-3.5 w-3.5 text-[#d4af37]" />
                <span>Tài khoản</span>
              </Link>
            </nav>
          ) : (
            location.pathname === BaseUrl.Homepage && (
              <nav className="hidden items-center gap-6 text-[15px] font-medium text-body sm:flex">
                <a
                  href="#cach-hoat-dong"
                  className="py-1 text-body no-underline transition-colors hover:text-[#f7e7b4]"
                >
                  Cách hoạt động
                </a>
                <a
                  href="#truong-phai"
                  className="py-1 text-body no-underline transition-colors hover:text-[#f7e7b4]"
                >
                  Trường phái
                </a>
                <a
                  href="#hoi-dap"
                  className="py-1 text-body no-underline transition-colors hover:text-[#f7e7b4]"
                >
                  Hỏi đáp
                </a>
              </nav>
            )
          )}
        </div>

        {rightAction !== "none" && (
          <div className="flex items-center gap-3">
            {isLogged ? (
              <>
                <Link
                  to={BaseUrl.Wallet}
                  data-testid="credit-balance-badge"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d4af37]/50 bg-gradient-to-r from-[#241842] to-[#1b1233] px-3 py-1 font-rune text-xs font-bold text-[#f7e7b4] shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all hover:border-[#d4af37] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                >
                  <Sparkles aria-hidden="true" className="h-3 w-3 text-[#d4af37]" />
                  <span>[{user?.creditBalance ?? 0} CREDITS]</span>
                </Link>

                <Popover open={openPopover} onOpenChange={setPopover}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="User menu"
                      className="flex h-8 w-8 cursor-pointer select-none items-center justify-center rounded-full border border-[#d4af37]/70 bg-gradient-to-br from-[#f3dc99] via-[#d4af37] to-[#9a7b2c] font-display text-sm font-bold text-[#0b0716] shadow-[0_0_15px_rgba(212,175,55,0.35)] transition-transform hover:scale-105 sm:h-9 sm:w-9"
                    >
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt="Avatar"
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        (user?.displayName || user?.username || "P")
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-56 rounded-xl border border-[#d4af37]/40 bg-[#140d26]/95 backdrop-blur-xl p-1.5 text-sm text-ink shadow-mystic-card"
                  >
                    <div className="truncate border-b border-hairline px-3 py-2.5 text-xs text-[#d4af37] font-medium flex items-center gap-1.5">
                      <span aria-hidden="true">✦</span>
                      <span>{user?.displayName || user?.username || "Người dùng"}</span>
                    </div>
                    <Link
                      to={BaseUrl.Account}
                      onClick={() => setPopover(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-[#241842] hover:text-[#f7e7b4]"
                    >
                      <User className="h-4 w-4 text-[#d4af37]" />
                      <span>Tài khoản</span>
                    </Link>
                    <Link
                      to={BaseUrl.Wallet}
                      onClick={() => setPopover(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-[#241842] hover:text-[#f7e7b4]"
                    >
                      <Wallet className="h-4 w-4 text-[#a855f7]" />
                      <span>Ví credits</span>
                    </Link>
                    <Link
                      to={BaseUrl.Referral}
                      onClick={() => setPopover(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-[#241842] hover:text-[#f7e7b4]"
                    >
                      <Gift className="h-4 w-4 text-[#34d399]" />
                      <span>Giới thiệu bạn bè</span>
                    </Link>
                    <Link
                      to={BaseUrl.ChangePassword}
                      onClick={() => setPopover(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-[#241842] hover:text-[#f7e7b4]"
                    >
                      <KeyRound className="h-4 w-4 text-[#f59e0b]" />
                      <span>Đổi mật khẩu</span>
                    </Link>
                    <div className="my-1 h-px bg-hairline" />
                    <button
                      type="button"
                      onClick={() => {
                        setPopover(false);
                        logout();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-[#4c0519]/40"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </PopoverContent>
                </Popover>
              </>
            ) : loading && !user ? (
              <div
                className="h-8 w-20 animate-pulse rounded-md bg-[#241842]/60 border border-[#d4af37]/20"
                aria-label="Đang tải..."
              />
            ) : isLoginPage ? (
              <Link
                to={BaseUrl.Register}
                className="btn-secondary !min-h-[36px] !px-4 !py-1.5 text-sm"
              >
                Đăng ký
              </Link>
            ) : location.pathname === BaseUrl.Homepage ? (
              <>
                <Link
                  to={BaseUrl.Login}
                  className="text-mute hover:text-[#f7e7b4] text-sm font-medium py-1.5 px-2 transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link to={BaseUrl.Scan} className="btn-primary !min-h-[38px] !px-5 !py-1.5 text-sm">
                  Bắt đầu
                </Link>
              </>
            ) : (
              <Link
                to={BaseUrl.Login}
                className="btn-secondary !min-h-[36px] !px-4 !py-1.5 text-sm"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
