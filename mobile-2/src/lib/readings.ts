import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { ReadingStatus, type HandOrientation, type ReadingDto, type ReadingListResponseDto, type ReadingSchool } from '@palmsight/shared';
import { del, get, upload } from './api';
import { getLanguage } from '../i18n';

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
export function toUploadPart(image: ImagePart): Blob {
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
  form.append('language', getLanguage());
  if (topics.length > 0) form.append('topics', topics.join(','));
  form.append('image', toUploadPart(image));

  return upload<CreateReadingResult>('/readings', form, {
    headers: { 'Idempotency-Key': idempotencyKey },
    timeoutMs: CREATE_TIMEOUT_MS,
  });
}

export function fetchReadings(cursor?: string, limit = 20): Promise<ReadingListResponseDto> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=${limit}` : `?limit=${limit}`;
  return get<ReadingListResponseDto>(`/readings${query}`);
}

/**
 * Trang kết quả được mở bằng cách chuyển từ phòng quét — nơi đã cầm sẵn kết quả xong — nên gọi
 * lại máy chủ để lấy đúng dữ liệu của vài giây trước là một vòng mạng thừa. Cache chỉ áp dụng cho
 * quẻ đã ở trạng thái cuối; quẻ đang xử lý vẫn phải hỏi server để không hiển thị kết quả cũ.
 */
const RECENT_READING_TTL_MS = 2000;
const recentReadings = new Map<string, { at: number; data: ReadingDto }>();

export async function fetchReading(id: string): Promise<ReadingDto> {
  const cached = recentReadings.get(id);
  if (cached && cached.data.status !== ReadingStatus.PROCESSING && Date.now() - cached.at < RECENT_READING_TTL_MS) {
    return cached.data;
  }

  const data = await get<ReadingDto>(`/readings/${encodeURIComponent(id)}`);
  recentReadings.set(id, { at: Date.now(), data });
  return data;
}

export async function deleteReading(id: string): Promise<void> {
  recentReadings.delete(id);
  await del<void>(`/readings/${encodeURIComponent(id)}`);
}
