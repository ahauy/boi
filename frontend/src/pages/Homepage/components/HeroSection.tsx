import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, Eye, Compass, Stars, Hand } from "lucide-react";
import BaseUrl from "@/consts/baseUrl";
import { useAuth } from "@/providers/AuthenticationProvider";
import MysticPalmOracle from "@/components/mystic/MysticPalmOracle";
import { TarotCorners } from "@/components/mystic/MysticDivider";

const ASCII_WORDMARK = `███ ███ █   █ █ ███ ███ ███ █ █ ███
█ █ █ █ █   ███ █    █  █   █ █  █
███ ███ █   ███ ███  █  █ █ ███  █
█   █ █ █   █ █   █  █  █ █ █ █  █
█   █ █ ███ █ █ ███ ███ ███ █ █  █`;

export const HeroSection = () => {
  const { isLogged } = useAuth();

  const handleScrollToSample = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.getElementById("vi-du-ket-qua");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative w-full pt-10 sm:pt-16 md:pt-20">
      <div className="max-w-[1100px] mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          <div className="lg:col-span-7 text-left flex flex-col items-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/50 bg-gradient-to-r from-[#2c1d4f]/90 via-[#1b1233]/90 to-[#2c1d4f]/90 px-4 py-1.5 mb-6 shadow-[0_0_20px_rgba(212,175,55,0.2)] select-none">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-[#d4af37]" />
              <span className="text-xs tracking-[0.2em] uppercase text-[#d4af37] font-semibold">
                ✦ Khai Mở Thiên Cơ ·
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#f7e7b4]">
                Miễn phí 3 credits
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-[54px] leading-[1.15] font-bold text-ink max-w-[700px] mb-5 drop-shadow-[0_2px_20px_rgba(212,175,55,0.18)]">
              Chụp lòng bàn tay. AI đọc chỉ tay giúp bạn.
            </h1>

            <p className="text-base sm:text-lg leading-relaxed text-body max-w-[580px] mb-8">
              Chọn phương Tây, phương Đông hoặc Ấn Độ, chụp một tấm ảnh và nhận bài bói trong chưa đầy một phút.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-4">
              <Link
                to={isLogged ? BaseUrl.Scan : BaseUrl.Login}
                className="btn-secondary text-base px-7 py-3"
              >
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                <span>Bắt đầu xem bói</span>
              </Link>
              {!isLogged && (
                <Link
                  to={BaseUrl.Scan}
                  data-testid="hero-guest-trial-cta"
                  className="btn-primary text-base px-6 py-3"
                >
                  <Hand aria-hidden="true" className="h-4 w-4" />
                  <span>Bói thử 1 lần</span>
                </Link>
              )}
              <a
                href="#vi-du-ket-qua"
                onClick={handleScrollToSample}
                className="btn-secondary text-base px-6 py-3"
              >
                <Eye aria-hidden="true" className="h-4 w-4 text-[#d4af37]" />
                <span>Xem ví dụ kết quả</span>
              </a>
            </div>

            <div className="flex items-center gap-2 text-sm text-mute mt-1">
              <span aria-hidden="true" className="text-[#d4af37]">
                ☽
              </span>
              <span>Đăng nhập bằng Google hoặc Facebook.</span>
            </div>

            <div
              aria-hidden="true"
              className="mt-8 pt-6 border-t border-hairline grid grid-cols-3 gap-4 sm:gap-8 w-full max-w-[540px]"
            >
              <div className="flex flex-col">
                <span className="font-display text-xl sm:text-2xl font-bold text-[#f7e7b4]">
                  3 Cổ Phái
                </span>
                <span className="text-xs text-mute">Đông · Tây · Ấn Độ</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xl sm:text-2xl font-bold text-[#f7e7b4]">
                  &lt; 60 Giây
                </span>
                <span className="text-xs text-mute">Thấu thị đường chỉ</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xl sm:text-2xl font-bold text-[#f7e7b4]">
                  100% Ẩn Danh
                </span>
                <span className="text-xs text-mute">Không lưu ảnh gốc</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex items-center justify-center">
            <MysticPalmOracle />
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-4 mt-14">
        <div className="relative mystic-card rounded-2xl px-6 sm:px-10 py-10 sm:py-12 text-left overflow-hidden">
          <TarotCorners />

          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-70"
          />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-hairline">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#d4af37] mb-2 font-semibold">
                <Compass aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Đài Chiêm Tinh · Huyền Cơ Điện</span>
              </div>
              <pre className="text-[11px] sm:text-[13px] md:text-[15px] leading-[1.1] text-[#f5d77f] font-bold select-none overflow-x-auto whitespace-pre font-rune drop-shadow-[0_0_10px_rgba(212,175,55,0.3)]">
                {ASCII_WORDMARK}
              </pre>
            </div>

            <div
              aria-hidden="true"
              className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs bg-[#0b0716]/60 border border-[#d4af37]/25 rounded-xl p-4"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fb7185] shadow-[0_0_8px_#fb7185]" />
                <span className="text-body">Tâm Đạo · Tình Duyên</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c084fc] shadow-[0_0_8px_#c084fc]" />
                <span className="text-body">Trí Đạo · Công Danh</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f5d77f] shadow-[0_0_8px_#f5d77f]" />
                <span className="text-body">Sinh Đạo · Thọ Mệnh</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34d399] shadow-[0_0_8px_#34d399]" />
                <span className="text-body">Định Mệnh · Thiên Thời</span>
              </div>
            </div>
          </div>

          <div className="bg-[#0b0716]/85 border border-[#d4af37]/40 rounded-xl px-4 py-3.5 text-[#f7e7b4] text-sm sm:text-base leading-normal font-rune shadow-inner flex items-center justify-between flex-wrap gap-2">
            <span>|  Phương Đông   Tay trái   [Bói toàn bộ]</span>
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1.5 text-xs text-[#34d399]"
            >
              <Stars className="h-3.5 w-3.5" />
              LINH KHÍ HỘI TỤ
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-mute font-rune">
            <span>tab đổi trường phái    enter xem bói</span>
            <span aria-hidden="true" className="text-[#d4af37]/80 tracking-widest">
              ☰ ☱ ☲ ☳ ☴ ☵ ☶ ☷
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
