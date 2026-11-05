import type {
  CreditTransactionListResponseDto,
  EnterReferralResponseDto,
  MeResponseDto,
  ReferralListResponseDto,
} from '@palmsight/shared';
import { del, get, patch, post, put, upload } from './api';
import { toUploadPart, type ImagePart } from './readings';

/** Kết quả của các endpoint hồ sơ: cùng dạng GET /me, gồm cả hasCustomAvatar. */
export type ProfileUser = MeResponseDto;

export function fetchMe(): Promise<MeResponseDto> {
  return get<MeResponseDto>('/me');
}

export function enterReferralCode(code: string): Promise<EnterReferralResponseDto> {
  return post<EnterReferralResponseDto>('/me/referral', { code });
}

export function fetchReferrals(cursor?: string): Promise<ReferralListResponseDto> {
  return get<ReferralListResponseDto>(cursor ? `/me/referrals?cursor=${encodeURIComponent(cursor)}` : '/me/referrals');
}

export function fetchCreditTransactions(cursor?: string): Promise<CreditTransactionListResponseDto> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : '?limit=20';
  return get<CreditTransactionListResponseDto>(`/me/credit-transactions${query}`);
}

export function updateProfile(displayName: string): Promise<ProfileUser> {
  return patch<ProfileUser>('/me', { displayName });
}

// Ảnh đại diện nhỏ: 30s đủ cho mạng yếu mà vẫn không treo nút mãi
const AVATAR_UPLOAD_TIMEOUT_MS = 30_000;

export function uploadAvatar(image: ImagePart): Promise<ProfileUser> {
  const form = new FormData();
  form.append('avatar', toUploadPart(image));
  return upload<ProfileUser>('/me/avatar', form, { timeoutMs: AVATAR_UPLOAD_TIMEOUT_MS });
}

/** Xoá tài khoản đang đăng nhập (DELETE /me). Server trả 204; ảnh lỗi thì 502 IMAGE_DELETE_FAILED. */
export function deleteAccount(): Promise<void> {
  return del<void>('/me');
}

export function removeAvatar(): Promise<ProfileUser> {
  return del<ProfileUser>('/me/avatar');
}
