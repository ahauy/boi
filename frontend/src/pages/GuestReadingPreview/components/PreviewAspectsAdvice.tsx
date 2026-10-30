import React from "react";
import { Stars, Sparkles, Lock } from "lucide-react";
import type {
  ReadingAspectPreviewDto,
  ReadingAdvicePreviewDto,
} from "@palmsight/shared";

interface PreviewAspectsAdviceProps {
  aspects?: Record<string, ReadingAspectPreviewDto> | null;
  advice?: ReadingAdvicePreviewDto | null;
}

export const PreviewAspectsAdvice: React.FC<PreviewAspectsAdviceProps> = ({
  aspects,
  advice,
}) => {
  const hasAspects = aspects && Object.keys(aspects).length > 0;

  return (
    <div className="mt-6 space-y-6" data-testid="preview-aspects-advice-block">
      {hasAspects && (
        <section className="p-5 sm:p-6 rounded bg-[#0b0716]/60 border border-hairline/70 text-left">
          <div className="flex items-center justify-between pb-2 mb-4 border-b border-hairline">
            <div className="flex items-center gap-2">
              <Stars aria-hidden="true" className="h-4 w-4 text-[#a855f7]" />
              <h3 className="font-display text-xl sm:text-2xl text-[#f7e7b4] font-bold m-0">
                Khía cạnh cuộc sống
              </h3>
            </div>
            <span className="font-rune text-xs text-[#f5d77f] px-2.5 py-1 rounded bg-[#241842] border border-[#d4af37]/40 flex items-center gap-1.5 select-none">
              <Lock aria-hidden="true" className="h-3 w-3" />
              <span>[#] NỘI DUNG ĐÃ KHÓA</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {Object.entries(aspects).map(([key, item]) => (
              <div
                key={key}
                data-testid={`preview-aspect-${key}`}
                className="relative p-3.5 rounded bg-[#140d26]/80 border border-hairline/50 overflow-hidden"
              >
                <div className="font-bold text-[#f7e7b4] text-sm font-rune mb-1">
                  [+] {item.title || key}
                </div>
                <div
                  aria-hidden="true"
                  className="text-sm text-body filter blur-[4px] select-none pointer-events-none opacity-40 leading-relaxed"
                >
                  Dự báo sâu sắc về vận thế phát triển và các cơ hội tiềm năng trong chu kỳ tới...
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {advice && (
        <section
          data-testid="preview-advice-block"
          className="p-5 sm:p-6 rounded bg-[#0b0716]/60 border border-hairline/70 text-left"
        >
          <div className="flex items-center justify-between pb-2 mb-4 border-b border-hairline">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="h-4 w-4 text-[#f5d77f]" />
              <h3 className="font-display text-xl sm:text-2xl text-[#f7e7b4] font-bold m-0">
                Lời khuyên thiên định
              </h3>
            </div>
            <span className="font-rune text-xs text-[#f5d77f] px-2.5 py-1 rounded bg-[#241842] border border-[#d4af37]/40 flex items-center gap-1.5 select-none">
              <Lock aria-hidden="true" className="h-3 w-3" />
              <span>[#] NỘI DUNG ĐÃ KHÓA</span>
            </span>
          </div>

          <div
            aria-hidden="true"
            className="p-3.5 rounded bg-[#140d26]/80 border border-hairline/50 filter blur-[4px] select-none pointer-events-none opacity-40 text-sm text-body leading-relaxed"
          >
            Thông điệp chiêm tinh học cổ xưa gửi gắm phương thức hoá giải xung đột và đón nhận vượng khí an lành...
          </div>
        </section>
      )}
    </div>
  );
};

export default PreviewAspectsAdvice;
