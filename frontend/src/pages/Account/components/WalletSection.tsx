import { Link } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import type { UserDto } from "../types";

interface WalletSectionProps {
  user: UserDto | null;
}

export const WalletSection = ({ user }: WalletSectionProps) => {
  return (
    <section id="vi-credits" className="mt-16 scroll-mt-32 md:scroll-mt-24 font-sans text-ink">
      <div className="pb-3 border-b border-gold/25 flex items-center gap-2">
        <span className="text-gold text-sm">✦</span>
        <h2 className="text-2xl font-display font-bold text-gold-gradient">Ví credits</h2>
      </div>

      <div className="mt-6 p-6 mystic-card rounded-2xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
        <TarotCorners />
        <div className="relative z-10">
          <span className="text-xs font-mono text-gold-dim uppercase font-bold tracking-wider block">
            Số dư hiện tại
          </span>
          <div
            data-testid="account-credits-display"
            className="text-3xl sm:text-4xl font-display font-bold text-gold-gradient mt-1"
          >
            {user?.creditBalance ?? 0} credits
          </div>
          <p className="text-xs text-mute mt-2">
            Credits không có hạn sử dụng. Mỗi lần xem bói tiêu thụ 1 credit.
          </p>
        </div>

        <Link
          to={BaseUrl.Wallet}
          className="btn-primary h-9 px-5 text-sm inline-flex items-center justify-center select-none shrink-0 relative z-10"
        >
          Ví credits &rarr;
        </Link>
      </div>

      <div className="mt-3">
        <Link
          to={BaseUrl.Wallet}
          className="text-xs font-medium text-gold-light underline underline-offset-4 hover:text-gold transition-colors"
        >
          Xem chi tiết lịch sử giao dịch tại Ví credits &rarr;
        </Link>
      </div>
    </section>
  );
};

export default WalletSection;
