import { Sun, Moon, Stars } from "lucide-react";
import { SchoolItem } from "../types";
import { TarotCorners } from "@/components/mystic/MysticDivider";

export const SCHOOLS_DATA: SchoolItem[] = [
  {
    title: "Chỉ tay phương Tây",
    description: "Dáng tay 4 nguyên tố, các đường chỉ chính và 7 gò",
    aspects: "Tình cảm · Trí tuệ · Sinh mệnh · Định mệnh · Danh vọng",
  },
  {
    title: "Chỉ tay phương Đông",
    description: "Dáng tay ngũ hành, Thiên – Nhân – Địa văn, cung bát quái",
    aspects:
      "Ngũ hành · Thiên văn · Nhân văn · Địa văn · Bát quái · Các ngón tay",
  },
  {
    title: "Chỉ tay Ấn Độ",
    description: "Gò theo 9 hành tinh, đường chính, dấu hiệu đặc biệt",
    aspects: "9 hành tinh · Đường chính · Dấu hiệu đặc biệt · Ngón cái",
  },
];

const SCHOOL_ORNAMENTS = [
  {
    icon: Sun,
    arcana: "ARCANA I · OCCIDENTAL",
    symbol: "☼ ♈ ♌ ♐",
    accent: "from-[#f59e0b]/20 to-transparent",
  },
  {
    icon: Moon,
    arcana: "ARCANA II · ORIENTAL BAGUA",
    symbol: "☯ ☰ ☷ ☲",
    accent: "from-[#d4af37]/25 to-transparent",
  },
  {
    icon: Stars,
    arcana: "ARCANA III · VEDIC HASTAREKHA",
    symbol: "✦ ♃ ♀ ♄",
    accent: "from-[#a855f7]/25 to-transparent",
  },
];

export const SchoolsSection = () => {
  return (
    <section
      id="truong-phai"
      className="max-w-[1100px] mx-auto px-4 mt-20 sm:mt-24 pt-8 hairline-top text-left scroll-mt-20 w-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
        <div>
          <span
            aria-hidden="true"
            className="text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold block mb-1"
          >
            ✦ Tam Đại Huyền Phái ✦
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            Trường phái
          </h2>
        </div>
        <p aria-hidden="true" className="text-sm text-mute">
          Tinh hoa chiêm đoán tướng tay từ ba nền văn minh cổ đại
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SCHOOLS_DATA.map((school, index) => {
          const ornament = SCHOOL_ORNAMENTS[index] || SCHOOL_ORNAMENTS[0];
          const IconComponent = ornament.icon;

          return (
            <div
              key={school.title}
              className="relative mystic-card-interactive rounded-2xl p-6 sm:p-7 flex flex-col justify-between overflow-hidden group"
            >
              <TarotCorners />
              <div
                aria-hidden="true"
                className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${ornament.accent} pointer-events-none`}
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-hairline">
                  <span
                    aria-hidden="true"
                    className="text-[11px] font-rune tracking-[0.18em] text-[#d4af37]"
                  >
                    {ornament.arcana}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-sm text-[#f7e7b4] tracking-widest"
                  >
                    {ornament.symbol}
                  </span>
                </div>

                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#d4af37]/45 bg-[#0b0716]/70 text-[#f5d77f] shadow-[0_0_20px_rgba(212,175,55,0.2)] group-hover:scale-105 transition-transform">
                  <IconComponent className="h-6 w-6" />
                </div>

                <div className="font-display text-2xl font-bold text-[#f7e7b4] mb-2">
                  {school.title}
                </div>

                <div className="text-base leading-relaxed text-body mb-5">
                  {school.description}
                </div>
              </div>

              <div className="relative z-10 pt-4 border-t border-hairline">
                <span
                  aria-hidden="true"
                  className="block text-[10px] uppercase tracking-[0.2em] text-[#d4af37]/80 mb-1"
                >
                  Các yếu tố luận giải
                </span>
                <div className="text-sm leading-relaxed text-mute">
                  {school.aspects}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default SchoolsSection;
