import {
  PalmLineDto,
  PalmLineName,
  ReadingSchool,
  HandOrientation,
} from "@palmsight/shared";

export const PALM_LINE_COLORS: Record<PalmLineName, string> = {
  life: "#00c853",
  head: "#ff9100",
  heart: "#ff1744",
  other: "#9e9e9e",
};

export interface PalmLineDisplayInfo {
  name: PalmLineName;
  nameLabel: string;
  subLabel: string;
  color: string;
}

export function getPalmLineDisplayInfo(
  lineName: PalmLineName,
  school: ReadingSchool = ReadingSchool.WESTERN
): PalmLineDisplayInfo {
  const color = PALM_LINE_COLORS[lineName] || "#d4af37";

  if (school === ReadingSchool.EASTERN) {
    if (lineName === "life") {
      return {
        name: "life",
        nameLabel: "Sinh đạo (Địa văn)",
        subLabel: "Đường sinh đạo (Bản mệnh & Thể lực)",
        color,
      };
    }
    if (lineName === "head") {
      return {
        name: "head",
        nameLabel: "Trí đạo (Nhân văn)",
        subLabel: "Đường trí đạo (Trí tuệ & Tư duy)",
        color,
      };
    }
    if (lineName === "heart") {
      return {
        name: "heart",
        nameLabel: "Tâm đạo (Thiên văn)",
        subLabel: "Đường tâm đạo (Tình cảm & Tâm tính)",
        color,
      };
    }
    return {
      name: "other",
      nameLabel: "Văn phụ",
      subLabel: "Đường nét phụ trong lòng bàn tay",
      color,
    };
  }

  if (lineName === "life") {
    return {
      name: "life",
      nameLabel: "Sinh đạo",
      subLabel: "Đường sinh mệnh (Sức sống & Vận thế)",
      color,
    };
  }
  if (lineName === "head") {
    return {
      name: "head",
      nameLabel: "Trí đạo",
      subLabel: "Đường trí tuệ (Tài trí & Quyết đoán)",
      color,
    };
  }
  if (lineName === "heart") {
    return {
      name: "heart",
      nameLabel: "Tâm đạo",
      subLabel: "Đường tình cảm (Trái tim & Nhân duyên)",
      color,
    };
  }
  return {
    name: "other",
    nameLabel: "Đường phụ",
    subLabel: "Chỉ tay bổ trợ",
    color,
  };
}

export function getCanonicalPalmLinePoints(
  lineName: PalmLineName,
  hand: HandOrientation = HandOrientation.RIGHT
): [number, number][] {
  const isRightHand = hand === HandOrientation.RIGHT;

  let basePoints: [number, number][];

  if (lineName === "life") {
    basePoints = [
      [0.62, 0.38],
      [0.61, 0.46],
      [0.57, 0.56],
      [0.51, 0.68],
      [0.47, 0.8],
      [0.48, 0.88],
    ];
  } else if (lineName === "head") {
    basePoints = [
      [0.6, 0.4],
      [0.52, 0.48],
      [0.42, 0.54],
      [0.32, 0.58],
      [0.22, 0.6],
    ];
  } else if (lineName === "heart") {
    basePoints = [
      [0.2, 0.42],
      [0.32, 0.39],
      [0.46, 0.36],
      [0.56, 0.34],
      [0.64, 0.3],
    ];
  } else {
    basePoints = [
      [0.46, 0.8],
      [0.44, 0.64],
      [0.43, 0.5],
      [0.43, 0.36],
    ];
  }

  if (isRightHand) {
    return basePoints;
  }

  return basePoints.map(([x, y]) => [
    Number((1 - x).toFixed(4)),
    Number(y.toFixed(4)),
  ]);
}

export function resolveEffectivePalmLines(
  palmLines?: PalmLineDto[] | null,
  hand: HandOrientation = HandOrientation.RIGHT
): PalmLineDto[] {
  const existing = Array.isArray(palmLines) ? palmLines : [];
  const results: PalmLineDto[] = [...existing];

  const coreNames: PalmLineName[] = ["life", "head", "heart"];
  for (const name of coreNames) {
    const hasLine = results.some((line) => line.name === name);
    if (!hasLine) {
      results.push({
        name,
        points: getCanonicalPalmLinePoints(name, hand),
        lengthRel: 0.5,
        curvature: 1.15,
        branches: 0,
      });
    }
  }

  const priority: Record<PalmLineName, number> = {
    life: 0,
    head: 1,
    heart: 2,
    other: 3,
  };

  results.sort((a, b) => priority[a.name] - priority[b.name]);
  return results;
}

export function findMatchingSectionId(
  lineName: PalmLineName,
  _school: ReadingSchool = ReadingSchool.WESTERN,
  sections?: Array<{ key?: string; title?: string }> | null
): string | null {
  if (!sections || sections.length === 0) {
    return null;
  }

  const aliasMap: Record<PalmLineName, string[]> = {
    life: ["diaVan", "lifeLine", "sinhDao", "sinhMenh", "majorLines"],
    head: ["nhanVan", "headLine", "triDao", "triTue", "majorLines"],
    heart: ["thienVan", "heartLine", "tamDao", "tinhCam", "majorLines"],
    other: ["fateLine", "sunLine", "mounts", "batQuai", "fingers"],
  };

  const keywordMap: Record<PalmLineName, string[]> = {
    life: ["địa văn", "sinh mệnh", "sinh đạo", "đường đời", "life"],
    head: ["nhân văn", "trí tuệ", "trí đạo", "đầu óc", "head"],
    heart: ["thiên văn", "tình cảm", "tâm đạo", "trái tim", "heart"],
    other: ["định mệnh", "danh vọng", "gò", "bát quái"],
  };

  const aliases = aliasMap[lineName] || [];
  for (const alias of aliases) {
    const match = sections.find((s) => s.key === alias);
    if (match) {
      return `section-${match.key}`;
    }
  }

  const keywords = keywordMap[lineName] || [];
  for (const kw of keywords) {
    const match = sections.find(
      (s) => s.title && s.title.toLowerCase().includes(kw)
    );
    if (match) {
      return match.key ? `section-${match.key}` : null;
    }
  }

  const fallbackMajor = sections.find((s) => s.key === "majorLines");
  if (fallbackMajor) {
    return `section-${fallbackMajor.key}`;
  }

  if (sections[0]?.key) {
    return `section-${sections[0].key}`;
  }

  return "section-0";
}

export function scrollToSection(sectionId: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const el = document.getElementById(sectionId);
  if (!el) {
    const queryFallback = document.querySelector(`[data-testid="${sectionId}"]`);
    if (queryFallback) {
      queryFallback.scrollIntoView({ behavior: "smooth", block: "center" });
      applyHighlightEffect(queryFallback as HTMLElement);
      return true;
    }
    return false;
  }

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  applyHighlightEffect(el);
  return true;
}

function applyHighlightEffect(target: HTMLElement) {
  target.classList.remove(
    "ring-2",
    "ring-[#d4af37]",
    "shadow-[0_0_30px_rgba(212,175,55,0.5)]",
    "transition-all",
    "duration-500"
  );
  void target.offsetWidth;
  target.classList.add(
    "ring-2",
    "ring-[#d4af37]",
    "shadow-[0_0_30px_rgba(212,175,55,0.5)]",
    "transition-all",
    "duration-500"
  );

  setTimeout(() => {
    target.classList.remove(
      "ring-2",
      "ring-[#d4af37]",
      "shadow-[0_0_30px_rgba(212,175,55,0.5)]"
    );
  }, 2200);
}
