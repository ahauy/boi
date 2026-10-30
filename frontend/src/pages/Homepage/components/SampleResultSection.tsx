import { Eye, Sparkles, ScrollText } from "lucide-react";
import { TarotCorners } from "@/components/mystic/MysticDivider";

export const SampleResultSection = () => {
  return (
    <section
      id="vi-du-ket-qua"
      className="max-w-[1100px] mx-auto px-4 mt-20 sm:mt-24 pt-8 hairline-top text-left scroll-mt-20 w-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
        <div>
          <span
            aria-hidden="true"
            className="text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold block mb-1"
          >
            ✦ Cổ Thư Luận Giải Mẫu ✦
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            Ví dụ kết quả
          </h2>
        </div>
        <p aria-hidden="true" className="text-sm text-mute">
          Trích đoạn một bản thiên mệnh được giải mã từ đường chỉ tay
        </p>
      </div>

      <div className="relative mystic-card p-6 sm:p-8 rounded-2xl overflow-hidden">
        <TarotCorners />

        <div className="text-xs sm:text-sm text-[#d4af37] font-rune pb-4 hairline-bottom mb-6 flex justify-between items-center flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 font-bold">
            <ScrollText aria-hidden="true" className="h-4 w-4" />
            <span>PALMSIGHT(1)</span>
          </span>
          <span className="px-3 py-0.5 rounded-full bg-[#241842] border border-[#d4af37]/40 text-[#f7e7b4]">
            Chỉ tay phương Đông
          </span>
          <span className="px-3 py-0.5 rounded-full bg-[#0b0716]/80 border border-hairline text-body">
            Tay trái
          </span>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-[#0b0716]/60 border border-[#d4af37]/30">
          <span className="text-base font-bold text-[#f7e7b4]">
            Tóm tắt:{" "}
          </span>
          <span className="text-base text-body leading-relaxed">
            Tay Thổ, thực tế và đáng tin cậy. Tình cảm chân thành, chậm mà chắc.
          </span>
        </div>

        <div className="font-display text-xl font-bold text-[#f7e7b4] mb-3 flex items-center gap-2">
          <span aria-hidden="true" className="text-[#d4af37]">
            ✦
          </span>
          <span>Dáng tay ngũ hành</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#140d26]/90 border border-hairline text-base leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1">
              <Eye aria-hidden="true" className="h-4 w-4 text-[#c084fc]" />
              <span className="font-bold text-[#f7e7b4]">[+] Quan sát</span>
            </div>
            <span className="text-body block">
              Lòng bàn tay vuông, ngón ngắn và chắc.
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[#140d26]/90 border border-hairline text-base leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles aria-hidden="true" className="h-4 w-4 text-[#d4af37]" />
              <span className="font-bold text-[#f7e7b4]">[+] Ý nghĩa</span>
            </div>
            <span className="text-body block">
              Tay Thổ: thực tế, đáng tin cậy, làm việc đâu ra đó.
            </span>
          </div>
        </div>
      </div>

      <div className="text-sm text-mute mt-3 flex items-center gap-2">
        <span aria-hidden="true" className="text-[#d4af37]">
          ✧
        </span>
        <span>Ví dụ minh hoạ, không phải kết quả thật.</span>
      </div>
    </section>
  );
};

export default SampleResultSection;
