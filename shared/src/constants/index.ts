import { ReadingSchool, LifeAspect } from "../enums";

export interface ReadingSchoolSectionConfig {
  key: string;
  label: string;
  title: string;
  description?: string;
}

export interface ReadingSchoolConfig {
  id: ReadingSchool;
  name: string;
  description: string;
  handHint?: string;
  sections: readonly ReadingSchoolSectionConfig[];
}

export interface LifeAspectConfig {
  key: LifeAspect;
  label: string;
}

export const READING_SCHOOLS: Record<ReadingSchool, ReadingSchoolConfig> = {
  [ReadingSchool.WESTERN]: {
    id: ReadingSchool.WESTERN,
    name: "Chỉ tay phương Tây",
    description: "Dáng tay 4 nguyên tố, các đường chỉ chính và 7 gò",
    sections: [
      {
        key: "handShape",
        label: "Dáng tay 4 nguyên tố",
        title: "Dáng tay 4 nguyên tố",
        description: "Đất, Khí, Lửa, Nước",
      },
      { key: "heartLine", label: "Đường tình cảm", title: "Đường tình cảm" },
      { key: "headLine", label: "Đường trí tuệ", title: "Đường trí tuệ" },
      { key: "lifeLine", label: "Đường sinh mệnh", title: "Đường sinh mệnh" },
      { key: "fateLine", label: "Đường định mệnh", title: "Đường định mệnh" },
      { key: "sunLine", label: "Đường danh vọng", title: "Đường danh vọng" },
      {
        key: "mounts",
        label: "7 gò",
        title: "7 gò",
        description:
          "Kim Tinh, Mộc Tinh, Thổ Tinh, Thái Dương, Thuỷ Tinh, Thái Âm, Hoả Tinh",
      },
    ],
  },
  [ReadingSchool.EASTERN]: {
    id: ReadingSchool.EASTERN,
    name: "Chỉ tay phương Đông",
    description: "Dáng tay ngũ hành, Thiên – Nhân – Địa văn, cung bát quái",
    handHint: "Nam xem tay trái, nữ xem tay phải",
    sections: [
      {
        key: "nguHanh",
        label: "Dáng tay ngũ hành",
        title: "Dáng tay ngũ hành",
        description: "Kim, Mộc, Thuỷ, Hoả, Thổ",
      },
      {
        key: "thienVan",
        label: "Thiên văn",
        title: "Thiên văn",
        description: "Đường tình cảm",
      },
      {
        key: "nhanVan",
        label: "Nhân văn",
        title: "Nhân văn",
        description: "Đường trí tuệ",
      },
      {
        key: "diaVan",
        label: "Địa văn",
        title: "Địa văn",
        description: "Đường sinh mệnh",
      },
      {
        key: "batQuai",
        label: "Cung bát quái",
        title: "Cung bát quái",
        description: "8 cung bát quái & Minh Đường",
      },
      { key: "fingers", label: "Các ngón tay", title: "Các ngón tay" },
    ],
  },
  [ReadingSchool.VEDIC]: {
    id: ReadingSchool.VEDIC,
    name: "Chỉ tay Ấn Độ",
    description: "Gò theo 9 hành tinh, đường chính, dấu hiệu đặc biệt",
    sections: [
      {
        key: "planetMounts",
        label: "Gò theo 9 hành tinh",
        title: "Gò theo 9 hành tinh",
      },
      { key: "majorLines", label: "Các đường chính", title: "Các đường chính" },
      {
        key: "specialSigns",
        label: "Dấu hiệu đặc biệt",
        title: "Dấu hiệu đặc biệt",
        description: "Hình cá, đinh ba, hoa sen, ngôi sao, chữ thập...",
      },
      { key: "thumb", label: "Ngón cái", title: "Ngón cái" },
    ],
  },
} as const;

export const READING_SCHOOL_LIST: readonly ReadingSchoolConfig[] = [
  READING_SCHOOLS[ReadingSchool.WESTERN],
  READING_SCHOOLS[ReadingSchool.EASTERN],
  READING_SCHOOLS[ReadingSchool.VEDIC],
];

export const LIFE_ASPECTS: readonly LifeAspectConfig[] = [
  { key: LifeAspect.PERSONALITY, label: "Tính cách" },
  { key: LifeAspect.LOVE, label: "Tình cảm" },
  { key: LifeAspect.CAREER, label: "Sự nghiệp" },
  { key: LifeAspect.FINANCE, label: "Tài chính" },
  { key: LifeAspect.HEALTH, label: "Sức khoẻ" },
  { key: LifeAspect.FAMILY, label: "Gia đạo" },
] as const;

export const LIFE_ASPECTS_MAP: Record<LifeAspect, LifeAspectConfig> = {
  [LifeAspect.PERSONALITY]: LIFE_ASPECTS[0],
  [LifeAspect.LOVE]: LIFE_ASPECTS[1],
  [LifeAspect.CAREER]: LIFE_ASPECTS[2],
  [LifeAspect.FINANCE]: LIFE_ASPECTS[3],
  [LifeAspect.HEALTH]: LIFE_ASPECTS[4],
  [LifeAspect.FAMILY]: LIFE_ASPECTS[5],
};

export const LIFE_ASPECT_KEYS = [
  LifeAspect.PERSONALITY,
  LifeAspect.LOVE,
  LifeAspect.CAREER,
  LifeAspect.FINANCE,
  LifeAspect.HEALTH,
  LifeAspect.FAMILY,
] as const;

export const CREDIT_AMOUNTS = {
  SIGNUP_BONUS: 3,
  REFERRAL_REWARD: 2,
  REFEREE_REWARD: 1,
  READING_COST: 1,
  REFERRAL_DAILY_CAP: 10,
  SIGNUP_BONUS_CREDITS: 3,
  REFERRAL_REWARD_CREDITS: 2,
  REFEREE_REWARD_CREDITS: 1,
  READING_COST_CREDITS: 1,
} as const;

export const REFERRAL_CODE_REGEX = /^[A-HJKMNP-Z2-9]{8}$/;
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export function getAllSchoolTopics(school: ReadingSchool): string[] {
  const schoolConfig = READING_SCHOOLS[school];
  if (!schoolConfig) return [];
  const sectionKeys = schoolConfig.sections.map((s) => s.key);
  const aspectKeys = LIFE_ASPECTS.map((a) => a.key as string);
  return [...sectionKeys, ...aspectKeys];
}

export function normalizeReadingTopics(
  school: ReadingSchool,
  rawTopics?: string | string[] | null
): string[] {
  const allAllowed = getAllSchoolTopics(school);
  if (!rawTopics || (typeof rawTopics === "string" && !rawTopics.trim())) {
    return allAllowed;
  }

  const requestedKeys = Array.isArray(rawTopics)
    ? rawTopics.map((k) => k.trim()).filter(Boolean)
    : rawTopics
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

  if (requestedKeys.length === 0) {
    return allAllowed;
  }

  const invalidKeys = requestedKeys.filter((k) => !allAllowed.includes(k));
  if (invalidKeys.length > 0) {
    throw new Error(
      `Mục bói không hợp lệ theo trường phái ${school}: ${invalidKeys.join(
        ", "
      )}`
    );
  }

  const uniqueRequested = new Set(requestedKeys);
  return allAllowed.filter((key) => uniqueRequested.has(key));
}

export function getTopicLabel(key: string, school: ReadingSchool): string {
  const aspect = LIFE_ASPECTS_MAP[key as LifeAspect];
  if (aspect) return aspect.label;
  const schoolConfig = READING_SCHOOLS[school];
  const section = schoolConfig?.sections.find((s) => s.key === key);
  if (section) return section.label;
  return key;
}
