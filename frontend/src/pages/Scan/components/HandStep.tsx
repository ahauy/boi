import React from "react";
import { Hand } from "lucide-react";
import { HandOrientation, ReadingSchool } from "@palmsight/shared";

interface HandStepProps {
  school: ReadingSchool;
  hand: HandOrientation;
  onSelectHand: (hand: HandOrientation) => void;
}

export const HandStep: React.FC<HandStepProps> = ({
  school,
  hand,
  onSelectHand,
}) => {
  return (
    <div className="flex flex-col mb-2">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Hand aria-hidden="true" className="h-4 w-4 text-[#d4af37]" />
          <h2 className="font-display text-xl text-[#f7e7b4] m-0 font-bold">
            3. Tay
          </h2>
        </div>
        <span className="text-xs text-[#d4af37]/70 font-rune">✦ Âm Dương</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-ink">
        <button
          type="button"
          onClick={() => onSelectHand(HandOrientation.LEFT)}
          className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer select-none font-rune focus:outline-none transition-all ${
            hand === HandOrientation.LEFT
              ? "border-[#d4af37] bg-[#2c1d4f]/85 text-[#f7e7b4] font-semibold shadow-[0_0_15px_rgba(212,175,55,0.2)]"
              : "border-hairline bg-[#0b0716]/45 text-mute hover:border-[#d4af37]/40 hover:text-ink"
          }`}
          data-testid="hand-left"
        >
          <span className="text-[#d4af37]">
            {hand === HandOrientation.LEFT ? "(x) " : "( ) "}
          </span>
          <span className="font-sans">Tay trái</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectHand(HandOrientation.RIGHT)}
          className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer select-none font-rune focus:outline-none transition-all ${
            hand === HandOrientation.RIGHT
              ? "border-[#d4af37] bg-[#2c1d4f]/85 text-[#f7e7b4] font-semibold shadow-[0_0_15px_rgba(212,175,55,0.2)]"
              : "border-hairline bg-[#0b0716]/45 text-mute hover:border-[#d4af37]/40 hover:text-ink"
          }`}
          data-testid="hand-right"
        >
          <span className="text-[#d4af37]">
            {hand === HandOrientation.RIGHT ? "(x) " : "( ) "}
          </span>
          <span className="font-sans">Tay phải</span>
        </button>
      </div>

      {school === ReadingSchool.EASTERN && (
        <div
          className="text-xs sm:text-sm text-[#d4af37]/90 mt-3 bg-[#0b0716]/50 border border-[#d4af37]/25 rounded-lg px-3 py-2"
          data-testid="eastern-hand-hint"
        >
          [i] Nam xem tay trái, nữ xem tay phải.
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-hairline">
        <p className="text-xs sm:text-sm text-mute m-0 leading-normal">
          [i] Giá 1 credit, dù chọn bao nhiêu mục
        </p>
      </div>
    </div>
  );
};

export default HandStep;
