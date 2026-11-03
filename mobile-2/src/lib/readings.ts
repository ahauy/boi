import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import type {
  HandOrientation,
  ReadingDto,
  ReadingListResponseDto,
  ReadingSchool,
} from '@palmsight/shared';
import { del, get, upload } from './api';

/**
 * Ảnh đã chụp/chọn trên máy. `uri` là đường dẫn native, không phải nội dung ảnh.
 */
export interface ImagePart {
  uri: string;
  name: string;
  type: string;
}

/**
 * RN 0.88 từ chối part dạng object `{uri, name, type}`: fetch báo
 * "Unsupported FormDataPart implementation" ngay trước khi gửi, nên quẻ không bao giờ tới server.
 * Native phải nhận một Blob thật — `File` của expo-file-system implements Blob và đọc thẳng từ URI,
 * không nạp cả ảnh vào bộ nhớ JS. Web giữ object vì ImagePicker ở đó trả blob URL trình duyệt hiểu.
 */
function toUploadPart(image: ImagePart): Blob {
  if (Platform.OS === 'web') return image as unknown as Blob;
  return new File(image.uri) as unknown as Blob;
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
  form.append('image', toUploadPart(image));

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
