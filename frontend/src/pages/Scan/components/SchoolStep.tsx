import React from "react";
import { Compass, Lock } from "lucide-react";
import { ReadingSchool, READING_SCHOOL_LIST } from "@palmsight/shared";
import { showError } from "@/helpers/toast";

interface SchoolStepProps {
  selectedSchool: ReadingSchool;
  onSelectSchool: (school: ReadingSchool) => void;
}

const SCHOOL_SYMBOLS: Record<ReadingSchool, string> = {
  [ReadingSchool.WESTERN]: "☼",
  [ReadingSchool.EASTERN]: "☯",
  [ReadingSchool.VEDIC]: "✦",
};

export const SchoolStep: React.FC<SchoolStepProps> = ({
  selectedSchool,
  onSelectSchool,
}) => {
  return (
    <div className="flex flex-col mb-8">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Compass aria-hidden="true" className="h-4 w-4 text-[#d4af37]" />
          <h2 className="font-display text-xl text-[#f7e7b4] m-0 font-bold">
            1. Trường phái
          </h2>
        </div>
        <span className="text-xs text-[#d4af37]/70 font-rune">✦ Huyền Học</span>
      </div>
      <div className="flex flex-col gap-3">
        {READING_SCHOOL_LIST.map((school) => {
          const isSelected = selectedSchool === school.id;
          const isVipSchool =
            school.id === ReadingSchool.EASTERN ||
            school.id === ReadingSchool.VEDIC;

          const handleClick = () => {
            if (isVipSchool) {
              showError(
                "Trường phái này chỉ dành cho tài khoản VIP. Bạn vui lòng nâng cấp VIP trên ứng dụng Android hoặc chọn trường phái Phương Tây."
              );
              return;
            }
            onSelectSchool(school.id);
          };

          return (
            <button
              key={school.id}
              type="button"
              aria-disabled={isVipSchool}
              onClick={handleClick}
              className={`w-full text-left p-4 rounded-xl border transition-all focus:outline-none relative overflow-hidden ${
                isVipSchool
                  ? "opacity-60 cursor-not-allowed border-hairline/60 bg-[#0b0716]/30"
                  : isSelected
                  ? "border-[#d4af37] bg-gradient-to-r from-[#2c1d4f]/90 to-[#1b1233]/90 shadow-[0_0_20px_rgba(212,175,55,0.2)] cursor-pointer"
                  : "border-hairline bg-[#0b0716]/45 hover:border-[#d4af37]/50 hover:bg-[#140d26]/80 cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-base text-[#f7e7b4] leading-tight font-semibold">
                    {isSelected ? "(x) " : "( ) "}
                    {school.name}
                  </div>
                  {isVipSchool && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-[#f7e7b4] bg-[#2c1d4f]/90 border border-[#d4af37]/60 rounded-full">
                      <Lock className="w-3 h-3 text-[#d4af37]" />
                      Chỉ VIP, mua trên app Android
                    </span>
                  )}
                </div>
                <span
                  aria-hidden="true"
                  className={`text-base ${
                    isSelected ? "text-[#d4af37]" : "text-mute"
                  }`}
                >
                  {isVipSchool ? "🔒" : SCHOOL_SYMBOLS[school.id]}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-mute mt-1.5 leading-relaxed">
                {school.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SchoolStep;
