import { mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';

const TEST_TMP_DIR = join(__dirname, '..', '.test-tmp');

// Lượt chạy song song từ phiên khác có thể đang dùng thư mục mới hơn mốc này.
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/** Dọn mongod data của các lượt test bị ngắt; chỉ đụng thư mục riêng của backend. */
export default function setup(): void {
  mkdirSync(TEST_TMP_DIR, { recursive: true });

  const staleBefore = Date.now() - STALE_AFTER_MS;
  for (const entry of readdirSync(TEST_TMP_DIR)) {
    const path = join(TEST_TMP_DIR, entry);
    if (statSync(path).mtimeMs < staleBefore) {
      rmSync(path, { recursive: true, force: true });
    }
  }
}
