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
    try {
      const response = await fetch(`${this.baseUrl()}/v1/analyze`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.get("PALM_SERVICE_TOKEN")}`,
          "Content-Type": "image/jpeg",
        },
        body: new Uint8Array(image),
        signal: AbortSignal.timeout(this.timeoutMs()),
      });

      if (!response.ok) {
        this.logger.warn(`palm-service trả về ${response.status}`);
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
