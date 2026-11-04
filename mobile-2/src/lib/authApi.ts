import type { AuthResponseDto } from '@palmsight/shared';
import { post } from './api';

// Tài khoản khách tự tạo theo thiết bị; gọi lại cùng deviceId sẽ mở lại đúng tài khoản.
// Vì vậy đây là POST an toàn khi lặp lại — cần tính đó để chống lại lần gọi đầu tiên đánh thức Render.
export function createDeviceSession(deviceId: string): Promise<AuthResponseDto> {
  return post<AuthResponseDto>('/auth/device', { deviceId }, { auth: false, timeoutMs: 30_000, retryOnNetworkError: true });
}
