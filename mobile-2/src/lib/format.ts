import { t } from '../i18n';
import {
  CREDIT_AMOUNTS,
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
    case CreditTransactionType.STARTER:
      return 'Quà chào mừng';
    case CreditTransactionType.REFERRAL_BONUS:
      return 'Thưởng giới thiệu';
    case CreditTransactionType.REFEREE_BONUS:
      return 'Thưởng nhập mã';
    case CreditTransactionType.READING_SPEND:
    case CreditTransactionType.SINGLE:
      return 'Xem bói';
    case CreditTransactionType.READING_REFUND:
    case CreditTransactionType.REFUND:
      return 'Hoàn GEM';
    case CreditTransactionType.REWARDED_AD:
    case CreditTransactionType.AD_REWARD:
      return 'Xem quảng cáo';
    case CreditTransactionType.CHECKIN:
      return 'Điểm danh hằng ngày';
    case CreditTransactionType.CHECKIN_MILESTONE:
      return 'Mốc chuỗi điểm danh';
    case CreditTransactionType.CHECKIN_RESTORE:
      return 'Khôi phục chuỗi điểm danh';
    case CreditTransactionType.WHEEL:
      return 'Thưởng vòng quay';
    case CreditTransactionType.WHEEL_SPIN:
      return 'Lượt quay bằng GEM';
    case CreditTransactionType.VIP_DAILY:
      return 'Quà VIP hằng ngày';
    case CreditTransactionType.GUEST_MERGE:
      return 'Gộp tài khoản khách';
    case CreditTransactionType.ADMIN_ADJUST:
    case CreditTransactionType.OPERATOR:
    default:
      return note ? `Điều chỉnh (${note})` : 'Điều chỉnh hệ thống';
  }
}

export const REFERRAL_AMOUNTS = {
  inviter: CREDIT_AMOUNTS.REFERRAL_REWARD,
  invitee: CREDIT_AMOUNTS.REFEREE_REWARD,
  cap: CREDIT_AMOUNTS.REFERRAL_DAILY_CAP,
};

export const SHARE_TEXT_INTRO = (code: string) =>
  t('referral.shareText', { code, invitee: REFERRAL_AMOUNTS.invitee });

/** Tên mặc định backend gán cho khách mới tạo (backend giữ nguyên tiếng Việt). */
export const DEFAULT_GUEST_DISPLAY_NAME = 'Khách';

/**
 * Tên hiển thị. Chỉ khách chưa đặt tên mới được dịch theo ngôn ngữ app; tên người dùng tự đặt
 * giữ nguyên, kể cả khi trùng chữ "Khách" ở tài khoản thường.
 */
export function displayNameOf(user: { isAnonymous?: boolean; displayName?: string | null } | null | undefined): string {
  const name = (user?.displayName ?? '').trim();
  if (user?.isAnonymous && (name === '' || name === DEFAULT_GUEST_DISPLAY_NAME)) return t('profile.anonymousName');
  return name;
}
