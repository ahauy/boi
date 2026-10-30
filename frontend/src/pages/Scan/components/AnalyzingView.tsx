import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { TarotCorners } from "@/components/mystic/MysticDivider";

export const AnalyzingView: React.FC = () => {
  const [seconds, setSeconds] = useState(0);
  const [dots, setDots] = useState("");
  const progress = Math.min(40, seconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    const dotTimer = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);

    return () => {
      clearInterval(timer);
      clearInterval(dotTimer);
    };
  }, []);

  return (
    <div
      className="relative w-full max-w-[600px] mx-auto py-16 px-8 mystic-card rounded-2xl flex flex-col items-center justify-center text-center select-none overflow-hidden"
      data-testid="analyzing-view"
    >
      <TarotCorners />

      <div className="relative w-28 h-28 flex items-center justify-center mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#d4af37]/60 animate-spin-slow" />
        <div className="absolute inset-2 rounded-full border-2 border-[#a855f7]/50 border-t-[#f7e7b4] animate-spin" />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2c1d4f] border border-[#d4af37] shadow-[0_0_25px_rgba(212,175,55,0.45)]">
          <Sparkles className="h-6 w-6 text-[#f5d77f] animate-pulse" />
        </div>
      </div>

      <div className="text-xs uppercase tracking-[0.25em] text-[#d4af37] font-rune mb-2">
        ✦ Thiên Cơ Luận Giải ✦
      </div>

      <h2 className="font-display text-3xl text-[#f7e7b4] font-bold mb-3">
        Đang đọc đường chỉ tay{dots}
      </h2>

      <p className="text-base text-body max-w-[440px] mb-8 leading-relaxed">
        Vui lòng đợi trong giây lát (có thể mất tới 40 giây). Hệ thống đang phân tích chi tiết các đặc điểm lòng bàn tay của bạn.
      </p>

      <div className="w-full bg-[#0b0716]/80 border border-[#d4af37]/35 p-5 rounded-xl text-left text-xs font-rune text-ink space-y-2 shadow-inner">
        <div className="flex justify-between text-[#f5d77f]">
          <span>Luận giải tướng tay &amp; vận mệnh</span>
          <span>{Math.min(45, seconds)}s / 45s</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={40}
          aria-label="Tiến độ phân tích lòng bàn tay"
          className="w-full bg-[#1b1233] h-2.5 rounded-full overflow-hidden border border-[#d4af37]/30"
        >
          <div
            className="h-full transition-all duration-1000 rounded-full"
            style={{
              width: `${Math.min(95, Math.max(8, (seconds / 40) * 100))}%`,
              background:
                "linear-gradient(90deg, #a855f7 0%, #d4af37 50%, #fff3d1 100%)",
              boxShadow: "0 0 12px rgba(212, 175, 55, 0.7)",
            }}
          />
        </div>
        <div className="text-mute text-[11px] pt-1">
          ✦ Đang soi đường Sinh Đạo · Trí Đạo · Tâm Đạo...
        </div>
      </div>
    </div>
  );
};

export default AnalyzingView;
