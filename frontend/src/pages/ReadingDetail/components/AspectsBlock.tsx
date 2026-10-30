import React from "react";
import { Stars } from "lucide-react";
import { LIFE_ASPECTS_MAP, LifeAspect } from "@palmsight/shared";

interface AspectsBlockProps {
  aspects?: Record<string, string> | null;
}

export const AspectsBlock: React.FC<AspectsBlockProps> = ({ aspects }) => {
  if (!aspects || Object.keys(aspects).length === 0) return null;

  return (
    <section
      className="mt-6 p-5 sm:p-6 rounded-xl bg-[#0b0716]/55 border border-hairline text-left"
      data-testid="reading-aspects-block"
    >
      <div className="flex items-center gap-2 pb-2 mb-4 border-b border-hairline">
        <Stars aria-hidden="true" className="h-4 w-4 text-[#a855f7]" />
        <h3 className="font-display text-xl sm:text-2xl text-[#f7e7b4] font-bold m-0">
          Khía cạnh cuộc sống
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {Object.entries(aspects).map(([key, content]) => {
          const aspectConfig = LIFE_ASPECTS_MAP[key as LifeAspect];
          const label = aspectConfig ? aspectConfig.label : key;

          return (
            <p
              key={key}
              className="text-base text-body leading-relaxed m-0 p-3.5 rounded-lg bg-[#140d26]/80 border border-hairline/50"
              data-testid={`aspect-${key}`}
            >
              <span className="text-[#f7e7b4] font-bold font-rune mr-1">
                [+] {label}{" "}
              </span>
              {content}
            </p>
          );
        })}
      </div>
    </section>
  );
};

export default AspectsBlock;
