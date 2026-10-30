import React from "react";
import { Eye, Sparkles, Lock } from "lucide-react";
import type { ReadingSectionPreviewDto } from "@palmsight/shared";

interface PreviewSectionsProps {
  sections: ReadingSectionPreviewDto[];
}

export const PreviewSections: React.FC<PreviewSectionsProps> = ({ sections }) => {
  if (!sections || sections.length === 0) return null;

  return (
    <div className="mt-6 space-y-5" data-testid="preview-sections-block">
      {sections.map((section, idx) => {
        const isLocked = section.isLocked;
        const sectionId = section.key ? `section-${section.key}` : `section-${idx}`;

        if (isLocked) {
          return (
            <section
              key={section.key || `locked-${idx}`}
              id={sectionId}
              className="relative p-5 sm:p-6 rounded bg-[#0b0716]/60 border border-hairline/70 text-left overflow-hidden transition-all duration-300"
              data-testid={`preview-section-locked-${section.key || idx}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-4 border-b border-hairline">
                <h3 className="font-display text-xl sm:text-2xl text-[#f7e7b4]/80 font-bold flex items-center gap-2 m-0">
                  <span aria-hidden="true" className="text-[#d4af37]/60">
                    ✦
                  </span>
                  <span>{section.title}</span>
                </h3>
                <span
                  data-testid="locked-badge"
                  className="font-rune text-xs text-[#f5d77f] px-2.5 py-1 rounded bg-[#241842] border border-[#d4af37]/40 flex items-center gap-1.5 select-none"
                >
                  <Lock aria-hidden="true" className="h-3 w-3" />
                  <span>[#] NỘI DUNG ĐÃ KHÓA</span>
                </span>
              </div>

              <div
                aria-hidden="true"
                className="space-y-3 filter blur-[4px] select-none pointer-events-none opacity-40"
              >
                <div className="text-base text-body leading-relaxed m-0 bg-[#140d26]/80 p-3.5 rounded border border-hairline/50">
                  <span className="text-[#c084fc] font-bold font-rune mr-1">
                    [+] Quan sát
                  </span>
                  Đường nét này chứa đựng chi tiết phong thủy định hướng, vận thế thăng trầm theo chu kỳ tuần hoàn.
                </div>
                <div className="text-base text-body leading-relaxed m-0 bg-[#140d26]/80 p-3.5 rounded border border-hairline/50">
                  <span className="text-[#f5d77f] font-bold font-rune mr-1">
                    [+] Ý nghĩa
                  </span>
                  Phân tích chiều sâu nhân tướng học dự báo các mốc chuyển giao quan trọng trong sự nghiệp và tình duyên.
                </div>
              </div>
            </section>
          );
        }

        return (
          <section
            key={section.key || `open-${idx}`}
            id={sectionId}
            className="p-5 sm:p-6 rounded bg-[#0b0716]/65 border border-hairline text-left transition-all duration-300 hover:border-[#d4af37]/45"
            data-testid={`preview-section-open-${section.key || idx}`}
          >
            <h3 className="font-display text-xl sm:text-2xl text-[#f7e7b4] pb-2 mb-4 border-b border-hairline font-bold flex items-center gap-2 m-0">
              <span aria-hidden="true" className="text-[#d4af37] text-base">
                ✦
              </span>
              <span>{section.title}</span>
            </h3>
            <div className="space-y-3">
              <p className="text-base text-body leading-relaxed m-0 bg-[#140d26]/80 p-3.5 rounded border border-hairline/50">
                <span className="text-[#c084fc] font-bold font-rune inline-flex items-center gap-1.5 mr-1">
                  <Eye aria-hidden="true" className="h-4 w-4 inline" />
                  [+] Quan sát{" "}
                </span>
                {section.observation}
              </p>
              <p className="text-base text-body leading-relaxed m-0 bg-[#140d26]/80 p-3.5 rounded border border-hairline/50">
                <span className="text-[#f5d77f] font-bold font-rune inline-flex items-center gap-1.5 mr-1">
                  <Sparkles aria-hidden="true" className="h-4 w-4 inline" />
                  [+] Ý nghĩa{" "}
                </span>
                {section.meaning}
              </p>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default PreviewSections;
