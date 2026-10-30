import type {
  CreateGuestReadingResponseDto,
  GuestReadingPreviewDto,
  HandOrientation,
  ReadingDto,
  ReadingListResponseDto,
  ReadingSchool,
} from '@palmsight/shared';
import { del, get, upload } from './api';

/** Ảnh đã chụp/chọn trên máy: React Native truyền file qua object URI, không dùng Blob như web. */
export interface ImagePart {
  uri: string;
  name: string;
  type: string;
}

export interface CreateReadingParams {
  school: ReadingSchool;
  hand: HandOrientation;
  topics: string[];
  aiConsent: boolean;
  image: ImagePart;
  idempotencyKey: string;
}

export interface CreateReadingResult {
  reading: ReadingDto;
  creditBalance: number;
}

// AI luận giải đồng bộ phía server, có thể mất tới 60 giây (web đặt timeout 60s)
const CREATE_TIMEOUT_MS = 75_000;

export function createReading({ school, hand, topics, aiConsent, image, idempotencyKey }: CreateReadingParams): Promise<CreateReadingResult> {
  const form = new FormData();
  form.append('school', school);
  form.append('hand', hand);
  form.append('aiConsent', String(aiConsent));
  if (topics.length > 0) form.append('topics', topics.join(','));
  // Kiểu của React Native khai báo part dạng Blob/File; object {uri,name,type} mới là cách chạy trên native
  form.append('image', image as unknown as Blob);

  return upload<CreateReadingResult>('/readings', form, {
    headers: { 'Idempotency-Key': idempotencyKey },
    timeoutMs: CREATE_TIMEOUT_MS,
  });
}

export function fetchReadings(cursor?: string): Promise<ReadingListResponseDto> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : '?limit=20';
  return get<ReadingListResponseDto>(`/readings${query}`);
}

export function fetchReading(id: string): Promise<ReadingDto> {
  return get<ReadingDto>(`/readings/${encodeURIComponent(id)}`);
}

export function deleteReading(id: string): Promise<void> {
  return del<void>(`/readings/${encodeURIComponent(id)}`);
}

export interface CreateGuestReadingParams {
  school: ReadingSchool;
  hand: HandOrientation;
  aiConsent: boolean;
  image: ImagePart;
  fingerprint: string;
  idempotencyKey: string;
}

export type CreateGuestReadingResult = CreateGuestReadingResponseDto;

export function createGuestReading({ school, hand, aiConsent, image, fingerprint, idempotencyKey }: CreateGuestReadingParams): Promise<CreateGuestReadingResult> {
  const form = new FormData();
  form.append('school', school);
  form.append('hand', hand);
  form.append('aiConsent', String(aiConsent));
  // Guest trên mobile bói toàn bộ mục (giống bấm "Bói toàn bộ" trên web) nên không gửi topics
  form.append('image', image as unknown as Blob);
  form.append('fingerprint', fingerprint);

  return upload<CreateGuestReadingResult>('/readings/guest', form, {
    headers: { 'Idempotency-Key': idempotencyKey },
    timeoutMs: CREATE_TIMEOUT_MS,
    auth: false,
  });
}

export function fetchGuestPreview(token: string): Promise<GuestReadingPreviewDto> {
  return get<GuestReadingPreviewDto>(`/readings/guest/${encodeURIComponent(token)}`, { auth: false });
}
