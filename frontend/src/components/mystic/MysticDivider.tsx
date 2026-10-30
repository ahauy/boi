import React from "react";

interface MysticDividerProps {
  className?: string;
  symbol?: string;
}

export const MysticDivider: React.FC<MysticDividerProps> = ({
  className = "",
  symbol = "✦ ☽ ☼ ☾ ✦",
}) => {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center gap-4 select-none my-4 ${className}`}
    >
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#d4af37]/45 to-[#d4af37]/70" />
      <span className="text-xs tracking-[0.35em] text-[#d4af37] font-display drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]">
        {symbol}
      </span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#d4af37]/45 to-[#d4af37]/70" />
    </div>
  );
};

export const TarotCorners: React.FC = () => (
  <>
    <span
      aria-hidden="true"
      className="pointer-events-none select-none absolute top-2.5 left-2.5 w-3.5 h-3.5 border-t border-l border-[#d4af37]/60"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none select-none absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t border-r border-[#d4af37]/60"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none select-none absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b border-l border-[#d4af37]/60"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none select-none absolute bottom-2.5 right-2.5 w-3.5 h-3.5 border-b border-r border-[#d4af37]/60"
    />
  </>
);

export default MysticDivider;
