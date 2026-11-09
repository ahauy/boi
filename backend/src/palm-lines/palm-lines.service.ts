import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parsePalmLinesInput, PalmLineDto } from "@palmsight/shared";

export interface PalmLinesAnalysis {
  /** Toạ độ chuẩn hoá 0-1 theo ảnh đã cắt `annotatedImage`, không theo ảnh gốc. */
  lines: PalmLineDto[];
  /** JPEG lòng bàn tay đã xoay thẳng và vẽ 3 đường chính; null khi không tìm được đường nào. */
  annotatedImage: Buffer | null;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ANNOTATED_BYTES = 8 * 1024 * 1024;
/** Proxy của Fly trả 502/503 hoặc ngắt kết nối khi máy đang bật dở: đợi một chút rồi gửi lại. */
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_500;

class RetryableError extends Error {
  override name = "RetryableError";
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Gọi dịch vụ palm-service (Python: MediaPipe + model ONNX) để vẽ đường chỉ tay.
 *
 * Không bao giờ ném lỗi: thiếu cấu hình, quá thời gian, lỗi mạng hay dữ liệu lạ đều trả null.
 * Lần xem bói vẫn hoàn tất bằng kết quả AI, chỉ thiếu ảnh đã vẽ. Đừng để lỗi ở đây đi tới
 * nhánh hoàn GEM của ReadingsService.
 */
@Injectable()
export class PalmLinesService {
  private readonly logger = new Logger(PalmLinesService.name);

  constructor(@Optional() private readonly configService?: ConfigService) {}

  private get(key: string): string {
    return String(
      this.configService?.get<string>(key) ?? process.env[key] ?? ""
    ).trim();
  }

  private baseUrl(): string {
    return this.get("PALM_SERVICE_URL").replace(/\/+$/, "");
  }

  isEnabled(): boolean {
    return Boolean(this.baseUrl() && this.get("PALM_SERVICE_TOKEN"));
  }

  private timeoutMs(): number {
    const raw = Number(this.get("PALM_SERVICE_TIMEOUT_MS"));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
  }

  /** `image` là ảnh đã qua ImageProcessorService (xoay theo EXIF, xoá metadata). */
  async analyze(image: Buffer): Promise<PalmLinesAnalysis | null> {
    if (!this.isEnabled() || !image?.length) return null;

    const started = Date.now();
    // Một mốc hết giờ chung cho mọi lần thử, để tổng thời gian chờ không vượt PALM_SERVICE_TIMEOUT_MS.
    const deadline = AbortSignal.timeout(this.timeoutMs());
    try {
      let response: Response | null = null;
      for (let attempt = 1; ; attempt++) {
        try {
          response = await fetch(`${this.baseUrl()}/v1/analyze`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.get("PALM_SERVICE_TOKEN")}`,
              "Content-Type": "image/jpeg",
            },
            body: new Uint8Array(image),
            signal: deadline,
          });
          if (!RETRYABLE_STATUS.has(response.status)) break;
          throw new RetryableError(`HTTP ${response.status}`);
        } catch (error) {
          // Hết giờ thì dừng luôn. Lỗi mạng (fetch ném TypeError) hoặc 502/503/504 thì thử lại một lần.
          const retryable = error instanceof RetryableError || error instanceof TypeError;
          if (!retryable || deadline.aborted || attempt >= MAX_ATTEMPTS) throw error;
          this.logger.warn(
            `palm-service chưa sẵn sàng (${(error as Error).message}), thử lại lần ${attempt + 1}`
          );
          await sleep(RETRY_DELAY_MS, deadline);
        }
      }

      if (!response?.ok) {
        this.logger.warn(`palm-service trả về ${response?.status}`);
        return null;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      if (payload?.ok !== true) {
        this.logger.log(
          `palm-service bỏ qua ảnh: ${String(payload?.reason ?? "unknown")}`
        );
        return null;
      }

      // Dữ liệu từ dịch vụ ngoài: lọc lại như dữ liệu client gửi.
      const lines = parsePalmLinesInput(payload.lines) ?? [];
      const annotatedImage = this.decodeImage(payload.annotatedImage);
      this.logger.log(
        `palm-service ok: ${lines.length} đường trong ${Date.now() - started}ms`
      );
      return { lines, annotatedImage };
    } catch (error) {
      const name = error instanceof Error ? error.name : "Error";
      this.logger.warn(
        `palm-service lỗi (${name}) sau ${Date.now() - started}ms`
      );
      return null;
    }
  }

  private decodeImage(value: unknown): Buffer | null {
    if (typeof value !== "string" || value.length === 0) return null;
    if (value.length > Math.ceil((MAX_ANNOTATED_BYTES * 4) / 3) + 4) return null;
    const buffer = Buffer.from(value, "base64");
    return buffer.length > 0 ? buffer : null;
  }
}
