import { AppState } from 'react-native';

/**
 * Ngủ `ms`, nhưng nếu app đang ở nền thì chờ tới khi quay lại tiền cảnh mới trả về.
 * Vòng poll kết quả quẻ dùng hàm này để không gọi API liên lục khi người dùng đã rời app,
 * mà vẫn bắt được kết quả ngay ở nhịp đầu tiên sau khi họ quay lại.
 */
export async function sleepUntilActive(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  if (AppState.currentState === 'active') return;

  await new Promise<void>((resolve) => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      subscription.remove();
      resolve();
    });
  });
}
