import { useState } from "react";
import { FaqItem } from "../types";

export const FAQ_DATA: FaqItem[] = [
  {
    question: "Ảnh của tôi có được lưu không?",
    answer:
      "Máy chủ xử lý ảnh tạm thời trên RAM để phân tích AI và không lưu trữ trên máy chủ hay dịch vụ đám mây nào theo ADR-0010, đảm bảo quyền riêng tư tuyệt đối.",
  },
  {
    question: "Kết quả có chính xác không?",
    answer:
      "Kết quả mang tính chiêm đoán giải trí và tham khảo dựa trên cổ thư kết hợp AI Vision.",
  },
  {
    question: "Nếu AI bị lỗi thì sao?",
    answer:
      "Hệ thống tự động hoàn trả 1 credit vào ví của bạn nếu ảnh không đạt yêu cầu hoặc xảy ra lỗi.",
  },
];

export const FaqSection = () => {
  const [openIndices, setOpenIndices] = useState<Record<number, boolean>>({
    0: true,
  });

  const toggleItem = (index: number) => {
    setOpenIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <section
      id="hoi-dap"
      className="max-w-[1100px] mx-auto px-4 mt-20 sm:mt-24 pt-8 hairline-top text-left scroll-mt-20 w-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
        <div>
          <span
            aria-hidden="true"
            className="text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold block mb-1"
          >
            ✦ Giải Đáp Huyền Cơ ✦
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            Hỏi đáp
          </h2>
        </div>
        <p aria-hidden="true" className="text-sm text-mute">
          Những thắc mắc thường gặp trước khi bắt đầu nghi thức xem chỉ tay
        </p>
      </div>

      <div className="space-y-4">
        {FAQ_DATA.map((item, index) => {
          const isOpen = !!openIndices[index];

          return (
            <div
              key={item.question}
              className={`rounded-xl border transition-all duration-200 px-5 py-4 ${
                isOpen
                  ? "mystic-card border-[#d4af37]/60 shadow-mystic-glow"
                  : "bg-[#140d26]/65 border-hairline hover:border-[#d4af37]/45"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(index)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${index}`}
                className="w-full text-left text-base sm:text-lg leading-relaxed font-semibold text-[#f7e7b4] cursor-pointer flex items-center justify-between gap-3 focus:outline-none"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-full border border-[#d4af37]/50 bg-[#0b0716]/80 text-sm text-[#d4af37]">
                    {isOpen ? "−" : "+"}
                  </span>
                  <span>{item.question}</span>
                </span>
              </button>
              {isOpen && (
                <div
                  id={`faq-answer-${index}`}
                  data-testid={`faq-answer-${index}`}
                  className="text-base leading-relaxed text-body mt-3 pl-9 pt-2 border-t border-hairline/60"
                >
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FaqSection;
