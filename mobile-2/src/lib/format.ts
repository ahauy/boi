import {
  CreditTransactionType,
  HandOrientation,
  ReadingSchool,
  getAllSchoolTopics,
  getTopicLabel,
} from '@palmsight/shared';

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/** Định dạng ngày kiểu web: dd/MM/yyyy HH:mm (không phụ thuộc Intl của Hermes). */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const SCHOOL_SHORT_LABEL: Record<ReadingSchool, string> = {
  [ReadingSchool.WESTERN]: 'TÂY',
  [ReadingSchool.EASTERN]: 'ĐÔNG',
  [ReadingSchool.VEDIC]: 'ẤN',
};

export function handLabel(hand: HandOrientation): string {
  return hand === HandOrientation.LEFT ? 'Tay trái' : 'Tay phải';
}

export function topicsLabel(topics: string[] | null | undefined, school: ReadingSchool): string {
  const count = topics?.length ?? 0;
  if (count === 0 || count >= getAllSchoolTopics(school).length) return 'Toàn bộ';
  return `${count} mục`;
}

export function topicLabels(topics: string[] | null | undefined, school: ReadingSchool): string[] {
  return (topics ?? []).map((key) => getTopicLabel(key, school));
}

export function transactionLabel(type: CreditTransactionType, note?: string): string {
  switch (type) {
    case CreditTransactionType.SIGNUP_BONUS:
      return 'Quà chào mừng';
    case CreditTransactionType.REFERRAL_BONUS:
      return 'Thưởng giới thiệu';
    case CreditTransactionType.REFEREE_BONUS:
      return 'Thưởng nhập mã';
    case CreditTransactionType.READING_SPEND:
      return 'Xem bói';
    case CreditTransactionType.READING_REFUND:
      return 'Hoàn credit';
    case CreditTransactionType.ADMIN_ADJUST:
      return note ? `Điều chỉnh (${note})` : 'Điều chỉnh hệ thống';
  }
}

export const SHARE_TEXT_INTRO = (code: string) =>
  `Nhập mã ${code} trên PalmSight: bạn được thêm 1 credit xem bói miễn phí`;
