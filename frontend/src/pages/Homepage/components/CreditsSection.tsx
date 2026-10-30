import { Gem, Gift, Sparkles } from "lucide-react";
import { TarotCorners } from "@/components/mystic/MysticDivider";

export const CreditsSection = () => {
  return (
    <section
      id="credits"
      className="max-w-[1100px] mx-auto px-4 mt-20 sm:mt-24 pt-8 hairline-top text-left scroll-mt-20 w-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
        <div>
          <span
            aria-hidden="true"
            className="text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold block mb-1"
          >
            ✦ Linh Thạch Năng Lượng ✦
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            Credits
          </h2>
        </div>
        <p aria-hidden="true" className="text-sm text-mute">
          Cơ chế quy đổi minh bạch, không giới hạn thời gian lưu trữ
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="relative mystic-card-interactive rounded-xl p-5 flex items-start gap-4">
          <TarotCorners />
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d4af37]/40 bg-[#0b0716]/80 text-[#f5d77f]">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="text-base leading-relaxed text-body">
            <span className="font-bold text-[#f7e7b4] block mb-0.5">
              [+] 3 credits
            </span>{" "}
            khi tạo tài khoản
          </div>
        </div>

        <div className="relative mystic-card-interactive rounded-xl p-5 flex items-start gap-4">
          <TarotCorners />
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d4af37]/40 bg-[#0b0716]/80 text-[#34d399]">
            <Gift aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="text-base leading-relaxed text-body">
            <span className="font-bold text-[#f7e7b4] block mb-0.5">
              [+] +2 credits
            </span>{" "}
            mỗi khi có người nhập mã giới thiệu của bạn
          </div>
        </div>

        <div className="relative mystic-card-interactive rounded-xl p-5 flex items-start gap-4">
          <TarotCorners />
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d4af37]/40 bg-[#0b0716]/80 text-[#c084fc]">
            <Gem aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="text-base leading-relaxed text-body">
            <span className="font-bold text-[#f7e7b4] block mb-0.5">
              [+] 1 lần xem = 1 credit
            </span>
            , dù chọn bao nhiêu mục
          </div>
        </div>
      </div>
    </section>
  );
};

export default CreditsSection;
