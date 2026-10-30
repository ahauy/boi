import { Link } from "react-router-dom";
import { Sparkles, Hand } from "lucide-react";
import BaseUrl from "@/consts/baseUrl";
import { useAuth } from "@/providers/AuthenticationProvider";
import { TarotCorners } from "@/components/mystic/MysticDivider";

export const CtaSection = () => {
  const { isLogged } = useAuth();

  return (
    <section className="max-w-[1100px] mx-auto px-4 mt-20 sm:mt-24 w-full">
      <div className="relative mystic-card rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center overflow-hidden">
        <TarotCorners />
        <div
          aria-hidden="true"
          className="text-xs uppercase tracking-[0.3em] text-[#d4af37] mb-3 font-semibold"
        >
          ✦ Vận Mệnh Trong Lòng Bàn Tay ✦
        </div>
        <h3 className="font-display text-2xl sm:text-4xl font-bold text-[#f7e7b4] max-w-[600px] mb-6">
          Sẵn sàng lắng nghe thông điệp từ những đường chỉ tay của bạn?
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to={isLogged ? BaseUrl.Scan : BaseUrl.Login}
            className="btn-secondary text-base px-8 py-3"
          >
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            <span>Bắt đầu xem bói</span>
          </Link>
          {!isLogged && (
            <Link
              to={BaseUrl.Scan}
              data-testid="bottom-guest-trial-cta"
              className="btn-primary text-base px-6 py-3"
            >
              <Hand aria-hidden="true" className="h-4 w-4" />
              <span>Bói thử 1 lần</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
