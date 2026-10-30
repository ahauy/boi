import React from "react";
import { Eye, Sparkles } from "lucide-react";
import type { ReadingSectionResult } from "@palmsight/shared";

interface SectionBlockProps {
  sections?: ReadingSectionResult[] | null;
}

export const SectionBlock: React.FC<SectionBlockProps> = ({ sections }) => {
  if (!sections || sections.length === 0) return null;

  return (
    <div className="mt-6 space-y-5" data-testid="reading-sections-block">
      {sections.map((section, idx) => {
        const sectionId = section.key ? `section-${section.key}` : `section-${idx}`;
        return (
          <section
            key={section.key || section.title || idx}
            id={sectionId}
            className="p-5 sm:p-6 rounded-xl bg-[#0b0716]/55 border border-hairline text-left transition-all duration-300 hover:border-[#d4af37]/45"
            data-testid={`section-${section.key || idx}`}
          >
            <h3 className="font-display text-xl sm:text-2xl text-[#f7e7b4] pb-2 mb-4 border-b border-hairline font-bold flex items-center gap-2">
              <span aria-hidden="true" className="text-[#d4af37] text-base">
                ✦
              </span>
              <span>{section.title}</span>
            </h3>
            <div className="space-y-3">
              <p className="text-base text-body leading-relaxed m-0 bg-[#140d26]/80 p-3.5 rounded-lg border border-hairline/50">
                <span className="text-[#c084fc] font-bold font-rune inline-flex items-center gap-1.5 mr-1">
                  <Eye aria-hidden="true" className="h-4 w-4 inline" />
                  [+] Quan sát{" "}
                </span>
                {section.observation}
              </p>
              <p className="text-base text-body leading-relaxed m-0 bg-[#140d26]/80 p-3.5 rounded-lg border border-hairline/50">
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

export default SectionBlock;
