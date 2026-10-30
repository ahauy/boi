import type { AuthResponseDto } from '@palmsight/shared';
import { post } from './api';

// Tài khoản khách tự tạo theo thiết bị; gọi lại cùng deviceId sẽ mở lại đúng tài khoản.
export function createDeviceSession(deviceId: string): Promise<AuthResponseDto> {
  return post<AuthResponseDto>('/auth/device', { deviceId }, { auth: false, timeoutMs: 30_000 });
}
