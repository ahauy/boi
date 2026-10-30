import React from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import BaseUrl from "@/consts/baseUrl";

interface StickyUnlockCardProps {
  claimToken: string;
}

export const StickyUnlockCard: React.FC<StickyUnlockCardProps> = ({ claimToken }) => {
  const navigate = useNavigate();

  const handleUnlock = () => {
    try {
      sessionStorage.setItem("ps_claim_token", claimToken);
      localStorage.setItem("ps_claim_token", claimToken);
    } catch {
      // Storage unavailable fallback
    }
    navigate(`${BaseUrl.Register}?claimToken=${encodeURIComponent(claimToken)}`);
  };

  return (
    <aside
      aria-label="Khóa nội dung bài bói"
      data-testid="sticky-unlock-card"
      className="sticky bottom-6 z-30 mt-10 w-full max-w-[800px] mx-auto"
    >
      <div className="relative rounded bg-[#140d26]/95 border border-[#d4af37]/60 p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Lock aria-hidden="true" className="h-5 w-5 text-[#f5d77f]" />
          <h2 className="font-display text-lg sm:text-2xl font-bold text-[#f7e7b4] tracking-wide m-0">
            MỞ KHÓA 100% BÀI BÓI VẬN MỆNH CHI TIẾT
          </h2>
        </div>
        <p className="text-body text-xs sm:text-sm max-w-[620px] mx-auto mb-5 leading-relaxed">
          Đăng ký tài khoản miễn phí để mở khóa toàn bộ bài đọc và nhận thêm các lượt xem mới!
        </p>
        <button
          type="button"
          onClick={handleUnlock}
          data-testid="unlock-now-button"
          className="btn-primary w-full sm:w-auto min-h-[44px] px-8 text-sm sm:text-base font-bold font-mono inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[#d4af37]/20 transition-all active:scale-[0.99]"
        >
          <span>[ ĐĂNG KÝ MỞ KHÓA NGAY ]</span>
        </button>
      </div>
    </aside>
  );
};

export default StickyUnlockCard;
