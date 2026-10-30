import {
  Injectable,
  HttpException,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import sharp, { Metadata } from "sharp";

export interface ProcessedImageResult {
  buffer: Buffer;
  base64: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  size: number;
}

const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_FORMATS = ["jpeg", "png", "webp", "heif"];

@Injectable()
export class ImageProcessorService {
  async validateAndProcess(
    file?: Express.Multer.File
  ): Promise<ProcessedImageResult> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Thiếu file ảnh lòng bàn tay.",
        details: {
          fields: [{ field: "image", message: "Vui lòng tải lên 1 file ảnh" }],
        },
      });
    }

    if (file.size > MAX_IMAGE_SIZE || file.buffer.length > MAX_IMAGE_SIZE) {
      throw new HttpException(
        {
          code: "IMAGE_TOO_LARGE",
          message: "Dung lượng ảnh vượt quá giới hạn 8MB.",
          details: {
            maxSize: MAX_IMAGE_SIZE,
            actualSize: file.size || file.buffer.length,
          },
        },
        HttpStatus.PAYLOAD_TOO_LARGE
      );
    }

    // Inspect real format from image buffer (magic bytes inspection by sharp)
    let metadata: Metadata;
    try {
      metadata = await sharp(file.buffer).metadata();
    } catch {
      throw new HttpException(
        {
          code: "UNSUPPORTED_IMAGE_TYPE",
          message: "Nội dung file không phải JPEG, PNG, WebP hoặc HEIC.",
        },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE
      );
    }

    if (!metadata.format || !ALLOWED_FORMATS.includes(metadata.format)) {
      throw new HttpException(
        {
          code: "UNSUPPORTED_IMAGE_TYPE",
          message: "Nội dung file không phải JPEG, PNG, WebP hoặc HEIC.",
          details: { detectedFormat: metadata.format },
        },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE
      );
    }

    // In-Memory Preprocessing (ADR-0010: Never store image on server)
    // 1. Auto-rotate based on EXIF
    // 2. Resize longest dimension to max 1280px
    // 3. Strip all EXIF / metadata
    // 4. Compress to JPEG quality 85
    const processedBuffer = await sharp(file.buffer)
      .rotate()
      .resize({
        width: 1280,
        height: 1280,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const finalMetadata = await sharp(processedBuffer).metadata();
    const base64 = `data:image/jpeg;base64,${processedBuffer.toString(
      "base64"
    )}`;

    return {
      buffer: processedBuffer,
      base64,
      mimeType: "image/jpeg",
      width: finalMetadata.width || 0,
      height: finalMetadata.height || 0,
      size: processedBuffer.length,
    };
  }
}
