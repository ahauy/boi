import React from "react";
import { Stars } from "lucide-react";
import {
  ReadingSchool,
  READING_SCHOOLS,
  LIFE_ASPECTS,
} from "@palmsight/shared";

interface TopicsStepProps {
  school: ReadingSchool;
  isAllTopics: boolean;
  selectedSections: string[];
  selectedAspects: string[];
  onChange: (isAll: boolean, sections: string[], aspects: string[]) => void;
}

export const TopicsStep: React.FC<TopicsStepProps> = ({
  school,
  isAllTopics,
  selectedSections,
  selectedAspects,
  onChange,
}) => {
  const currentSchool = READING_SCHOOLS[school];
  const allSectionKeys = currentSchool.sections.map((s) => s.key);
  const allAspectKeys = LIFE_ASPECTS.map((a) => a.key);

  const totalPossible = allSectionKeys.length + allAspectKeys.length;
  const currentSelectedCount = isAllTopics
    ? totalPossible
    : selectedSections.length + selectedAspects.length;

  const handleToggleAll = () => {
    if (isAllTopics) {
      const newAspects = allAspectKeys.slice(0, -1);
      onChange(false, allSectionKeys, newAspects);
    } else {
      onChange(true, allSectionKeys, [...allAspectKeys]);
    }
  };

  const handleToggleSection = (key: string) => {
    let nextSections: string[];
    const nextAspects = isAllTopics ? [...allAspectKeys] : [...selectedAspects];

    if (isAllTopics) {
      nextSections = allSectionKeys.filter((k) => k !== key);
    } else {
      if (selectedSections.includes(key)) {
        nextSections = selectedSections.filter((k) => k !== key);
      } else {
        nextSections = [...selectedSections, key];
      }
    }

    const isAllNow =
      nextSections.length === allSectionKeys.length &&
      nextAspects.length === allAspectKeys.length;

    onChange(isAllNow, nextSections, nextAspects);
  };

  const handleToggleAspect = (key: string) => {
    const nextSections = isAllTopics
      ? [...allSectionKeys]
      : [...selectedSections];
    let nextAspects: string[];

    if (isAllTopics) {
      nextAspects = allAspectKeys.filter((k) => k !== key);
    } else {
      if (selectedAspects.includes(key)) {
        nextAspects = selectedAspects.filter((k) => k !== key);
      } else {
        nextAspects = [...selectedAspects, key];
      }
    }

    const isAllNow =
      nextSections.length === allSectionKeys.length &&
      nextAspects.length === allAspectKeys.length;

    onChange(isAllNow, nextSections, nextAspects);
  };

  const isSectionSelected = (key: string) =>
    isAllTopics || selectedSections.includes(key);

  const isAspectSelected = (key: string) =>
    isAllTopics || selectedAspects.includes(key);

  return (
    <div className="flex flex-col mb-8">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Stars aria-hidden="true" className="h-4 w-4 text-[#a855f7]" />
          <h2 className="font-display text-xl text-[#f7e7b4] m-0 font-bold">
            2. Mục muốn bói
          </h2>
        </div>
        <span className="text-xs text-[#d4af37]/70 font-rune">✦ Quẻ Mệnh</span>
      </div>

      <button
        type="button"
        onClick={handleToggleAll}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-base flex items-center gap-2 cursor-pointer select-none text-left focus:outline-none transition-all ${
          isAllTopics
            ? "border-[#d4af37]/60 bg-[#2c1d4f]/70 text-[#f7e7b4] font-semibold shadow-[0_0_15px_rgba(212,175,55,0.15)]"
            : "border-hairline bg-[#0b0716]/40 text-body hover:border-[#d4af37]/40"
        }`}
        data-testid="toggle-all-topics"
      >
        <span className="font-rune text-[#d4af37]">
          {isAllTopics ? "[x] " : "[ ] "}
        </span>
        <span>Bói toàn bộ</span>
      </button>

      <div className="text-xs uppercase tracking-[0.15em] text-[#d4af37]/90 mt-4 mb-2 font-semibold">
        Đường chỉ & dấu hiệu (
        {currentSchool.name.replace("Chỉ tay ", "").toLowerCase()})
      </div>
      <div className="flex flex-col space-y-1.5 bg-[#0b0716]/45 p-3 rounded-xl border border-hairline/60">
        {currentSchool.sections.map((section) => {
          const checked = isSectionSelected(section.key);
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => handleToggleSection(section.key)}
              className={`py-1 px-2 rounded-lg text-left text-sm flex items-center gap-2 cursor-pointer select-none font-rune focus:outline-none transition-colors ${
                isAllTopics
                  ? "text-body/80 hover:text-[#f7e7b4]"
                  : checked
                  ? "text-[#f7e7b4] font-medium bg-[#241842]/70"
                  : "text-mute hover:text-ink"
              }`}
              data-testid={`topic-section-${section.key}`}
            >
              <span className={checked ? "text-[#d4af37]" : "text-mute"}>
                {checked ? "[x]" : "[ ]"}
              </span>
              <span className="font-sans text-sm">{section.title}</span>
            </button>
          );
        })}
      </div>

      <div className="text-xs uppercase tracking-[0.15em] text-[#d4af37]/90 mt-4 mb-2 font-semibold">
        Khía cạnh cuộc sống
      </div>
      <div className="grid grid-cols-2 gap-2 bg-[#0b0716]/45 p-3 rounded-xl border border-hairline/60">
        {LIFE_ASPECTS.map((aspect) => {
          const checked = isAspectSelected(aspect.key);
          return (
            <button
              key={aspect.key}
              type="button"
              onClick={() => handleToggleAspect(aspect.key)}
              className={`py-1 px-2 rounded-lg text-left text-sm flex items-center gap-2 cursor-pointer select-none font-rune focus:outline-none transition-colors ${
                isAllTopics
                  ? "text-body/80 hover:text-[#f7e7b4]"
                  : checked
                  ? "text-[#f7e7b4] font-medium bg-[#241842]/70"
                  : "text-mute hover:text-ink"
              }`}
              data-testid={`topic-aspect-${aspect.key}`}
            >
              <span className={checked ? "text-[#d4af37]" : "text-mute"}>
                {checked ? "[x]" : "[ ]"}
              </span>
              <span className="font-sans text-sm">{aspect.label}</span>
            </button>
          );
        })}
      </div>

      {currentSelectedCount === 0 && (
        <p
          className="text-danger text-sm mt-3 font-medium"
          data-testid="no-topics-warning"
        >
          [!] Chọn ít nhất 1 mục
        </p>
      )}
    </div>
  );
};

export default TopicsStep;
