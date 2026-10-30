import React, { useState, useRef, useEffect, useMemo } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import {
  PalmLineDto,
  PalmLineName,
  ReadingSchool,
  HandOrientation,
} from "@palmsight/shared";
import {
  resolveEffectivePalmLines,
  getPalmLineDisplayInfo,
  findMatchingSectionId,
  scrollToSection,
  PALM_LINE_COLORS,
} from "./palmUtils";

export interface PalmViewerProps {
  imageUrl?: string | null;
  annotatedImageUrl?: string | null;
  palmLines?: PalmLineDto[] | null;
  hand?: HandOrientation;
  school?: ReadingSchool;
  sections?: Array<{ key?: string; title?: string }> | null;
  className?: string;
  onLineClick?: (lineName: PalmLineName) => void;
  selectedLine?: PalmLineName | null;
  compact?: boolean;
}

export const PalmViewer: React.FC<PalmViewerProps> = ({
  imageUrl,
  annotatedImageUrl,
  palmLines,
  hand = HandOrientation.RIGHT,
  school = ReadingSchool.WESTERN,
  sections,
  className = "",
  onLineClick,
  selectedLine = null,
  compact = false,
}) => {
  const [showLines, setShowLines] = useState(true);
  const [hoveredLine, setHoveredLine] = useState<PalmLineName | null>(null);
  const [activeLine, setActiveLine] = useState<PalmLineName | null>(selectedLine);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveLine(selectedLine);
  }, [selectedLine]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const effectiveLines = useMemo(() => {
    if (Array.isArray(palmLines) && palmLines.length > 0) {
      return palmLines.filter((l) => l.name !== "other");
    }
    if (annotatedImageUrl) {
      return [];
    }
    return resolveEffectivePalmLines(palmLines, hand);
  }, [annotatedImageUrl, palmLines, hand]);

  const activeImageSrc = useMemo(() => {
    return showLines
      ? annotatedImageUrl || imageUrl || null
      : imageUrl || annotatedImageUrl || null;
  }, [showLines, imageUrl, annotatedImageUrl]);

  const handleLineTrigger = (lineName: PalmLineName) => {
    setActiveLine(lineName);
    onLineClick?.(lineName);

    const targetSectionId = findMatchingSectionId(lineName, school, sections);
    if (targetSectionId) {
      scrollToSection(targetSectionId);
    }
  };

  const handleLineMouseEnter = (
    lineName: PalmLineName,
    e: React.MouseEvent<SVGElement>
  ) => {
    setHoveredLine(lineName);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: Math.max(20, Math.min(rect.width - 20, e.clientX - rect.left)),
        y: Math.max(20, Math.min(rect.height - 20, e.clientY - rect.top)),
      });
    }

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    hoverTimerRef.current = setTimeout(() => {
      const targetSectionId = findMatchingSectionId(lineName, school, sections);
      if (targetSectionId) {
        scrollToSection(targetSectionId);
      }
    }, 380);
  };

  const handleLineMouseMove = (e: React.MouseEvent<SVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      x: Math.max(20, Math.min(rect.width - 20, e.clientX - rect.left)),
      y: Math.max(20, Math.min(rect.height - 20, e.clientY - rect.top)),
    });
  };

  const handleLineMouseLeave = () => {
    setHoveredLine(null);
    setTooltipPos(null);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const hoveredInfo = hoveredLine
    ? getPalmLineDisplayInfo(hoveredLine, school)
    : null;

  return (
    <div
      className={`relative w-full bg-[#0b0716] border border-[#d4af37]/40 rounded-xl overflow-hidden flex flex-col ${className}`}
      data-testid="interactive-palm-viewer"
    >
      <div
        ref={containerRef}
        className={`relative w-full aspect-square mx-auto flex items-center justify-center bg-[#07040f] overflow-hidden ${
          compact ? "max-w-[240px]" : "max-w-[340px]"
        }`}
        data-testid="palm-viewer-viewport"
      >
        {activeImageSrc ? (
          <img
            src={activeImageSrc}
            alt="Bàn tay phân tích chỉ tay"
            className="w-full h-full object-contain select-none pointer-events-none"
            data-testid="palm-viewer-image"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-b from-[#140d26] via-[#0b0716] to-[#140d26]"
            data-testid="palm-viewer-silhouette"
          >
            <svg
              viewBox="0 0 200 240"
              className="w-48 h-56 text-[#d4af37]/25 animate-pulse"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M 60 230 C 50 190 40 160 30 130 C 25 110 35 100 45 115 C 50 125 55 140 60 150 C 55 120 52 90 55 60 C 57 45 70 45 72 65 C 75 90 77 125 80 145 C 80 110 82 70 88 40 C 90 25 104 25 106 45 C 109 80 110 120 112 145 C 114 115 118 75 125 60 C 128 48 140 50 140 68 C 140 100 138 135 138 160 C 145 140 152 125 162 120 C 172 115 178 128 172 142 C 160 170 150 195 140 230 Z"
                strokeDasharray="4 3"
              />
            </svg>
            <span className="absolute bottom-3 font-rune text-[11px] text-[#d4af37]/70">
              ✦ SƠ ĐỒ CHỈ TAY CHIÊM TINH ✦
            </span>
          </div>
        )}

        {showLines && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full z-10"
            data-testid="palm-viewer-svg"
          >
            <defs>
              <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {effectiveLines.map((line, idx) => {
              const isHovered = hoveredLine === line.name;
              const isActive = activeLine === line.name;
              const isOtherHovered = hoveredLine !== null && !isHovered;
              const color = PALM_LINE_COLORS[line.name] || "#d4af37";
              const pointsStr = line.points
                .map(([x, y]) => `${x * 100},${y * 100}`)
                .join(" ");

              return (
                <g
                  key={`${line.name}-${idx}`}
                  data-testid={`palm-line-group-${line.name}`}
                  className="transition-opacity duration-200"
                >
                  <polyline
                    fill="none"
                    stroke="transparent"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={pointsStr}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onMouseEnter={(e) => handleLineMouseEnter(line.name, e)}
                    onMouseMove={handleLineMouseMove}
                    onMouseLeave={handleLineMouseLeave}
                    onClick={() => handleLineTrigger(line.name)}
                    data-testid={`palm-line-hitarea-${line.name}`}
                  />

                  <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? "4" : isActive ? "3.2" : "2.4"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={pointsStr}
                    opacity={
                      isHovered
                        ? 0.95
                        : isActive
                        ? 0.8
                        : annotatedImageUrl
                        ? 0
                        : isOtherHovered
                        ? 0.15
                        : 0.45
                    }
                    filter={isHovered || isActive ? "url(#gold-glow)" : undefined}
                    style={{ pointerEvents: "none" }}
                    data-testid={`palm-line-glow-${line.name}`}
                  />

                  <polyline
                    fill="none"
                    stroke={isHovered ? "#ffffff" : color}
                    strokeWidth={isHovered ? "2" : isActive ? "1.6" : "1.2"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={pointsStr}
                    opacity={
                      isHovered
                        ? 1
                        : isActive
                        ? 0.9
                        : annotatedImageUrl
                        ? 0
                        : isOtherHovered
                        ? 0.2
                        : 0.9
                    }
                    style={{ pointerEvents: "none" }}
                    data-testid={`palm-line-core-${line.name}`}
                  />
                </g>
              );
            })}
          </svg>
        )}

        {hoveredInfo && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 bg-[#1b1233]/95 border border-[#d4af37] px-3 py-1.5 rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.8),0_0_12px_rgba(212,175,55,0.4)] backdrop-blur-sm text-left transition-all duration-150"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${Math.max(tooltipPos.y - 12, 40)}px`,
            }}
            data-testid="palm-line-hover-tooltip"
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#f7e7b4]">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block animate-pulse"
                style={{ backgroundColor: hoveredInfo.color }}
              />
              <span>{hoveredInfo.nameLabel}</span>
            </div>
            <p className="text-[11px] text-body mt-0.5 mb-1 leading-tight">
              {hoveredInfo.subLabel}
            </p>
            <span className="text-[10px] text-[#d4af37] font-rune flex items-center gap-1">
              <Sparkles className="h-3 w-3 inline" />
              <span>Nhấp để xem luận giải</span>
            </span>
          </div>
        )}
      </div>

      <div
        className="p-3 bg-[#140d26]/95 border-t border-hairline flex flex-col gap-2.5"
        data-testid="palm-viewer-controls"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#d4af37] font-rune font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Đường chỉ tay AI</span>
          </div>
          <button
            type="button"
            onClick={() => setShowLines((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#0b0716] border border-[#d4af37]/40 text-[#f7e7b4] hover:border-[#d4af37] transition-colors cursor-pointer"
            data-testid="palm-viewer-toggle-button"
          >
            {showLines ? (
              <>
                <EyeOff className="h-3 w-3 text-[#d4af37]" />
                <span>Ẩn đường chỉ tay</span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 text-[#d4af37]" />
                <span>Hiện đường chỉ tay</span>
              </>
            )}
          </button>
        </div>

        {showLines && (
          <div
            className="flex flex-wrap items-center gap-1.5 text-xs"
            data-testid="palm-viewer-legend"
          >
            {(["life", "head", "heart"] as const).map((key) => {
              const info = getPalmLineDisplayInfo(key, school);
              const isSelected = activeLine === key;
              const isHovered = hoveredLine === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleLineTrigger(key)}
                  onMouseEnter={() => setHoveredLine(key)}
                  onMouseLeave={() => setHoveredLine(null)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                    isSelected || isHovered
                      ? "bg-[#2c1d4f] border-[#d4af37] text-[#f7e7b4] shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                      : "bg-[#0b0716]/80 border-hairline text-body hover:border-[#d4af37]/60 hover:text-[#f7e7b4]"
                  }`}
                  data-testid={`palm-legend-button-${key}`}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: info.color }}
                  />
                  <span>{info.nameLabel}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PalmViewer;
