import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, Share2, Trash2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import BaseUrl from "@/consts/baseUrl";
import {
  ReadingDto,
  READING_SCHOOLS,
  HandOrientation,
  PalmLineName,
  getTopicLabel,
} from "@palmsight/shared";
import { format } from "date-fns";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import {
  PALM_LINE_COLORS,
  resolveEffectivePalmLines,
  getPalmLineDisplayInfo,
  findMatchingSectionId,
  scrollToSection,
} from "@/components/palm/palmUtils";

interface ReadingHeaderProps {
  reading: ReadingDto;
  onOpenDelete: () => void;
}

export const ReadingHeader: React.FC<ReadingHeaderProps> = ({
  reading,
  onOpenDelete,
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showLines, setShowLines] = useState(true);
  const [hoveredLine, setHoveredLine] = useState<PalmLineName | null>(null);
  const [activeLine, setActiveLine] = useState<PalmLineName | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const schoolConfig = READING_SCHOOLS[reading.school];
  const handLabel =
    reading.hand === HandOrientation.LEFT ? "Tay trái" : "Tay phải";

  const totalSections = schoolConfig?.sections?.length ?? 0;
  const isAll =
    !reading.topics ||
    reading.topics.length === 0 ||
    reading.topics.length >= totalSections + 6;

  const topicsBadge = isAll ? "Toàn bộ" : `${reading.topics.length} mục`;

  let formattedDate = "";
  try {
    formattedDate = format(new Date(reading.createdAt), "dd/MM/yyyy HH:mm");
  } catch {
    formattedDate = reading.createdAt;
  }

  const hasStoredVisuals = Boolean(
    reading.imageUrl ||
      reading.annotatedImageUrl ||
      (reading.palmLines && reading.palmLines.length > 0)
  );

  const activeImageSrc =
    showLines && reading.annotatedImageUrl
      ? reading.annotatedImageUrl
      : reading.imageUrl || reading.annotatedImageUrl || null;

  const effectiveLines = useMemo(() => {
    if (Array.isArray(reading.palmLines) && reading.palmLines.length > 0) {
      return reading.palmLines.filter((l) => l.name !== "other");
    }
    if (reading.annotatedImageUrl) {
      return [];
    }
    return resolveEffectivePalmLines(reading.palmLines, reading.hand);
  }, [reading.palmLines, reading.annotatedImageUrl, reading.hand]);

  const handleLineTrigger = (lineName: PalmLineName) => {
    setActiveLine(lineName);
    const targetSectionId = findMatchingSectionId(
      lineName,
      reading.school,
      reading.result?.sections
    );
    if (targetSectionId) {
      scrollToSection(targetSectionId);
    }
  };

  const handleLineMouseEnter = (
    lineName: PalmLineName,
    e: React.MouseEvent<SVGElement>
  ) => {
    setHoveredLine(lineName);

    if (viewerRef.current) {
      const rect = viewerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: Math.max(20, Math.min(rect.width - 20, e.clientX - rect.left)),
        y: Math.max(20, Math.min(rect.height - 20, e.clientY - rect.top)),
      });
    }

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    hoverTimerRef.current = setTimeout(() => {
      const targetSectionId = findMatchingSectionId(
        lineName,
        reading.school,
        reading.result?.sections
      );
      if (targetSectionId) {
        scrollToSection(targetSectionId);
      }
    }, 380);
  };

  const handleLineMouseMove = (e: React.MouseEvent<SVGElement>) => {
    if (!viewerRef.current) return;
    const rect = viewerRef.current.getBoundingClientRect();
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
    ? getPalmLineDisplayInfo(hoveredLine, reading.school)
    : null;

  const handleShare = async () => {
    const textPieces: string[] = [
      `PALMSIGHT - ${schoolConfig?.name ?? reading.school}`,
      `${handLabel} · ${formattedDate}`,
      `Mục xem: ${
        isAll
          ? "Toàn bộ"
          : (reading.topics || [])
              .map((t) => getTopicLabel(t, reading.school))
              .join(", ")
      }`,
      "",
    ];

    if (reading.result?.summary) {
      textPieces.push(`[Tóm tắt]\n${reading.result.summary}\n`);
    }

    if (reading.result?.sections && reading.result.sections.length > 0) {
      reading.result.sections.forEach((sec) => {
        textPieces.push(
          `[${sec.title}]\n[+] Quan sát: ${sec.observation}\n[+] Ý nghĩa: ${sec.meaning}\n`
        );
      });
    }

    if (reading.result?.aspects) {
      textPieces.push("[Khía cạnh cuộc sống]");
      Object.entries(reading.result.aspects).forEach(([k, v]) => {
        textPieces.push(`[+] ${k}: ${v}`);
      });
      textPieces.push("");
    }

    if (reading.result?.advice) {
      textPieces.push(`[Lời khuyên]\n${reading.result.advice}\n`);
    }

    const fullText = textPieces.join("\n");

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="w-full lg:w-[310px] shrink-0 lg:sticky lg:top-24 self-start">
      <div className="mb-5">
        <Link
          to={BaseUrl.Readings}
          className="inline-flex items-center gap-1.5 text-sm text-[#f7e7b4] hover:text-[#d4af37] transition-colors cursor-pointer"
          data-testid="back-to-history"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          <span>&lt; Lịch sử</span>
        </Link>
      </div>

      <div className="relative mystic-card rounded-2xl p-5">
        <TarotCorners />

        {hasStoredVisuals ? (
          <div
            className="relative w-full bg-[#0b0716] border border-[#d4af37]/40 rounded-xl overflow-hidden"
            data-testid="reading-palm-viewer"
          >
            <div
              ref={viewerRef}
              className="relative w-full aspect-square max-w-[280px] mx-auto flex items-center justify-center bg-[#07040f] overflow-hidden"
            >
              {activeImageSrc && (
                <img
                  src={activeImageSrc}
                  alt="Ảnh chỉ tay đã phân tích"
                  className="w-full h-full object-contain select-none pointer-events-none"
                  data-testid="reading-palm-image"
                />
              )}

              {showLines && (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full z-10"
                  data-testid="reading-palm-svg-overlay"
                >
                  <defs>
                    <filter
                      id="reading-gold-glow"
                      x="-20%"
                      y="-20%"
                      width="140%"
                      height="140%"
                    >
                      <feGaussianBlur stdDeviation="1" result="blur" />
                      <feComposite
                        in="SourceGraphic"
                        in2="blur"
                        operator="over"
                      />
                    </filter>
                  </defs>

                  {effectiveLines.map((line, idx) => {
                    const isHovered = hoveredLine === line.name;
                    const isActive = activeLine === line.name;
                    const isOtherHovered =
                      hoveredLine !== null && !isHovered;
                    const color = PALM_LINE_COLORS[line.name] || "#d4af37";
                    const pointsStr = line.points
                      .map(([x, y]) => `${x * 100},${y * 100}`)
                      .join(" ");

                    return (
                      <g
                        key={`${line.name}-${idx}`}
                        className="transition-opacity duration-200"
                      >
                        <polyline
                          fill="none"
                          stroke="transparent"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={pointsStr}
                          style={{
                            pointerEvents: "stroke",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) =>
                            handleLineMouseEnter(line.name, e)
                          }
                          onMouseMove={handleLineMouseMove}
                          onMouseLeave={handleLineMouseLeave}
                          onClick={() => handleLineTrigger(line.name)}
                          data-testid={`palm-line-hitarea-${line.name}`}
                        />

                        <polyline
                          fill="none"
                          stroke={color}
                          strokeWidth={
                            isHovered ? "4" : isActive ? "3.2" : "2.4"
                          }
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={pointsStr}
                          opacity={
                            isHovered
                              ? 0.95
                              : isActive
                              ? 0.8
                              : reading.annotatedImageUrl
                              ? 0
                              : isOtherHovered
                              ? 0.25
                              : 0.45
                          }
                          filter={
                            isHovered || isActive
                              ? "url(#reading-gold-glow)"
                              : undefined
                          }
                          style={{ pointerEvents: "none" }}
                        />

                        <polyline
                          fill="none"
                          stroke={isHovered ? "#ffffff" : color}
                          strokeWidth={
                            isHovered ? "2" : isActive ? "1.6" : "1.2"
                          }
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={pointsStr}
                          opacity={
                            isHovered
                              ? 1
                              : isActive
                              ? 0.9
                              : reading.annotatedImageUrl
                              ? 0
                              : isOtherHovered
                              ? 0.35
                              : 0.9
                          }
                          style={{ pointerEvents: "none" }}
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

            <div className="p-3 bg-[#140d26]/90 border-t border-hairline flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-rune text-[#d4af37] flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Sơ đồ chỉ tay AI</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowLines((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#0b0716] border border-[#d4af37]/40 text-[#f7e7b4] hover:border-[#d4af37] cursor-pointer"
                  data-testid="reading-toggle-lines-button"
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
                  className="flex flex-wrap items-center gap-1.5 text-[11px]"
                  data-testid="reading-palm-legend"
                >
                  {(["life", "head", "heart"] as const).map((key) => {
                    const matched = (
                      reading.palmLines && reading.palmLines.length > 0
                        ? reading.palmLines
                        : effectiveLines
                    ).find((l) => l.name === key);
                    if (!matched) return null;
                    const info = getPalmLineDisplayInfo(key, reading.school);
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
        ) : (
          <div
            className="relative w-full h-[190px] bg-gradient-to-b from-[#0b0716] via-[#1c1136] to-[#0b0716] border border-[#d4af37]/40 flex flex-col items-center justify-center p-4 text-center select-none rounded-xl overflow-hidden"
            data-testid="reading-emblem"
          >
            <svg
              aria-hidden="true"
              className="absolute w-40 h-40 text-[#d4af37]/15 animate-spin-slow pointer-events-none"
              viewBox="0 0 200 200"
              fill="none"
            >
              <circle
                cx="100"
                cy="100"
                r="90"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <polygon
                points="100,15 125,75 185,100 125,125 100,185 75,125 15,100 75,75"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>

            <span className="relative z-10 text-[11px] font-rune text-[#d4af37] tracking-[0.2em] uppercase">
              ✦ Ấn Chứng Thiên Mệnh ✦
            </span>
            <span className="relative z-10 font-display text-lg font-bold text-[#f7e7b4] mt-2">
              [{schoolConfig?.name ?? reading.school}]
            </span>
            <span className="relative z-10 text-xs font-rune text-body mt-1">
              ✦ {handLabel} ✦
            </span>
            <span className="relative z-10 text-[10px] text-mute mt-3 font-rune border border-[#d4af37]/30 bg-[#0b0716]/80 px-2.5 py-0.5 rounded-full">
              NO_IMAGE_STORED // ADR-0010
            </span>
          </div>
        )}

        <div className="mt-5 text-left">
          <h2 className="font-display text-2xl text-[#f7e7b4] font-bold">
            {schoolConfig?.name ?? reading.school}
          </h2>
          <p className="text-xs sm:text-sm text-mute mt-1 font-rune">
            {handLabel} · {formattedDate}
          </p>
          <div className="mt-3">
            <span
              className="inline-block bg-[#241842] border border-[#d4af37]/45 text-[#f7e7b4] text-xs px-3 py-0.5 rounded-full select-none font-rune"
              data-testid="reading-topics-badge"
            >
              {topicsBadge}
            </span>
          </div>
          {!isAll && reading.topics && reading.topics.length > 0 && (
            <div
              className="mt-3 flex flex-wrap gap-1.5"
              data-testid="reading-selected-topics"
            >
              {reading.topics.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-0.5 bg-[#0b0716]/70 border border-hairline rounded-full font-rune text-body"
                >
                  [{getTopicLabel(t, reading.school)}]
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 pt-5 border-t border-hairline flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate(BaseUrl.Scan)}
            className="btn-primary w-full text-xs sm:text-sm py-2.5 px-4 text-center leading-snug"
            data-testid="re-scan-button"
          >
            <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>Bói thêm mục khác / trường phái khác (−1 credit)</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="btn-secondary w-full text-xs sm:text-sm py-2 px-4 text-center"
            data-testid="share-button"
          >
            <Share2
              aria-hidden="true"
              className="h-3.5 w-3.5 text-[#d4af37] shrink-0"
            />
            <span>{copied ? "Đã sao chép văn bản" : "Chia sẻ phần chữ"}</span>
          </button>

          <button
            type="button"
            onClick={onOpenDelete}
            className="w-full bg-[#4c0519]/25 text-danger border border-danger/50 font-medium text-xs sm:text-sm min-h-[38px] py-2 px-3 text-center rounded-full hover:bg-[#4c0519]/50 transition-colors leading-tight cursor-pointer inline-flex items-center justify-center gap-2"
            data-testid="delete-button"
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>Xoá lần xem này</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReadingHeader;
