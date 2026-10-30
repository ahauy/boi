import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface CountdownBannerProps {
  expiresAt: string;
}

export const CountdownBanner: React.FC<CountdownBannerProps> = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>(() => calculateTimeLeft(expiresAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(expiresAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (timeLeft.isExpired) {
    return (
      <div
        data-testid="countdown-expired"
        className="mb-6 p-3 rounded bg-[#4c0519]/40 border border-terminal-danger/60 text-terminal-danger font-rune text-xs sm:text-sm flex items-center justify-between"
      >
        <span className="flex items-center gap-1.5 font-bold">
          [!] BÀI BÓI ĐÃ HẾT HẠN LƯU TRỮ
        </span>
        <span className="text-mute text-xs">Vui lòng quét lại ảnh mới</span>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = timeLeft;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div
      data-testid="countdown-banner"
      className="mb-6 p-3 rounded bg-[#140d26]/80 border border-hairline text-ink font-rune text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-2 select-none"
    >
      <div className="flex items-center gap-2 text-[#d4af37]">
        <Clock aria-hidden="true" className="h-4 w-4 text-[#d4af37]" />
        <span className="font-bold tracking-wide">
          [#] BẢN XEM TRƯỚC 50% KẾT QUẢ BÓI TOÁN
        </span>
      </div>
      <div className="flex items-center gap-1 text-[#f7e7b4]">
        <span className="text-mute">Thời hạn lưu trữ:</span>
        <span className="font-bold font-mono text-[#f5d77f] bg-[#0b0716] px-2 py-0.5 rounded border border-hairline/60">
          {pad(days)}d {pad(hours)}h {pad(minutes)}m {pad(seconds)}s
        </span>
      </div>
    </div>
  );
};

function calculateTimeLeft(expiresAt: string) {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    isExpired: false,
  };
}

export default CountdownBanner;
