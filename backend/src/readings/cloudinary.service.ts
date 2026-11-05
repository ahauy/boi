import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

export class CloudinaryUploadError extends Error {}

export interface CloudinaryUploadOptions {
  folder?: string;
  publicId?: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(@Optional() private readonly configService?: ConfigService) {}

  private getConfig() {
    const cloudName =
      this.configService?.get<string>("CLOUDINARY_CLOUD_NAME") ??
      process.env.CLOUDINARY_CLOUD_NAME ??
      "";
    const apiKey =
      this.configService?.get<string>("CLOUDINARY_API_KEY") ??
      process.env.CLOUDINARY_API_KEY ??
      "";
    const apiSecret =
      this.configService?.get<string>("CLOUDINARY_API_SECRET") ??
      process.env.CLOUDINARY_API_SECRET ??
      "";
    const folder =
      this.configService?.get<string>("CLOUDINARY_FOLDER") ??
      process.env.CLOUDINARY_FOLDER ??
      "palmsight/readings";

    return {
      cloudName: cloudName.trim(),
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      folder: folder.trim() || "palmsight/readings",
    };
  }

  // Folder ảnh đại diện tách khỏi ảnh lòng bàn tay: cùng gốc với CLOUDINARY_FOLDER
  getAvatarFolder(): string {
    const explicit = (
      this.configService?.get<string>("CLOUDINARY_AVATAR_FOLDER") ??
      process.env.CLOUDINARY_AVATAR_FOLDER ??
      ""
    ).trim();
    if (explicit) return explicit;
    const root = this.getConfig().folder.replace(/\/+$/, "");
    return `${root.replace(/\/readings$/, "")}/avatars`;
  }

  isConfigured(): boolean {
    const { cloudName, apiKey, apiSecret } = this.getConfig();
    return Boolean(cloudName && apiKey && apiSecret);
  }

  signParams(params: Record<string, string | number>, apiSecret: string): string {
    const serialized = Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== "")
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    return crypto
      .createHash("sha1")
      .update(`${serialized}${apiSecret}`)
      .digest("hex");
  }

  // Data URI chỉ dùng cho dev. Production không lưu ảnh vào MongoDB: thiếu cấu hình hoặc
  // tải lỗi thì trả null, lần xem vẫn hoàn tất nhưng không có ảnh.
  private fallbackUpload(
    dataUri: string,
    reason: string,
    publicId?: string
  ): CloudinaryUploadResult | null {
    const nodeEnv =
      this.configService?.get<string>("NODE_ENV") ?? process.env.NODE_ENV;
    if (nodeEnv === "production") {
      this.logger.error(`Không lưu ảnh: ${reason}`);
      return null;
    }
    return {
      url: dataUri,
      publicId: `local:${publicId || crypto.randomUUID()}`,
    };
  }

  async uploadImage(
    buffer: Buffer,
    options?: CloudinaryUploadOptions
  ): Promise<CloudinaryUploadResult | null> {
    if (!buffer || buffer.length === 0) {
      return null;
    }

    const { cloudName, apiKey, apiSecret, folder } = this.getConfig();
    const targetFolder = options?.folder || folder;
    const dataUri = `data:image/jpeg;base64,${buffer.toString("base64")}`;

    if (!cloudName || !apiKey || !apiSecret) {
      return this.fallbackUpload(
        dataUri,
        "Cloudinary chưa được cấu hình",
        options?.publicId
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = {
      folder: targetFolder,
      timestamp,
    };
    if (options?.publicId) {
      paramsToSign.public_id = options.publicId;
    }

    const signature = this.signParams(paramsToSign, apiSecret);
    const body = new URLSearchParams({
      file: dataUri,
      api_key: apiKey,
      timestamp: String(timestamp),
      folder: targetFolder,
      signature,
    });
    if (options?.publicId) {
      body.set("public_id", options.publicId);
    }

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        }
      );

      if (!response.ok) {
        return this.fallbackUpload(
          dataUri,
          `Cloudinary trả về ${response.status}`,
          options?.publicId
        );
      }

      const payload = (await response.json()) as {
        secure_url?: string;
        public_id?: string;
      };

      if (!payload.secure_url || !payload.public_id) {
        return this.fallbackUpload(
          dataUri,
          "Phản hồi Cloudinary không hợp lệ",
          options?.publicId
        );
      }

      return {
        url: payload.secure_url,
        publicId: payload.public_id,
      };
    } catch {
      return this.fallbackUpload(
        dataUri,
        "Không kết nối được Cloudinary",
        options?.publicId
      );
    }
  }

  /**
   * Upload thật, không có đường lùi về data URI như uploadImage: avatar lưu vào DB nên
   * phải là URL https của Cloudinary, mọi lỗi đều ném CloudinaryUploadError.
   */
  async uploadImageStrict(
    buffer: Buffer,
    mimeType: string,
    options: CloudinaryUploadOptions
  ): Promise<CloudinaryUploadResult> {
    const { cloudName, apiKey, apiSecret } = this.getConfig();
    if (!cloudName || !apiKey || !apiSecret) {
      throw new CloudinaryUploadError("Cloudinary chưa được cấu hình");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = { timestamp };
    if (options.folder) paramsToSign.folder = options.folder;
    if (options.publicId) paramsToSign.public_id = options.publicId;

    const body = new URLSearchParams({
      file: `data:${mimeType};base64,${buffer.toString("base64")}`,
      api_key: apiKey,
      timestamp: String(timestamp),
      signature: this.signParams(paramsToSign, apiSecret),
    });
    if (options.folder) body.set("folder", options.folder);
    if (options.publicId) body.set("public_id", options.publicId);

    let payload: { secure_url?: string; public_id?: string };
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
          signal: AbortSignal.timeout(20_000),
        }
      );
      if (!response.ok) {
        throw new CloudinaryUploadError(`Cloudinary trả về ${response.status}`);
      }
      payload = (await response.json()) as typeof payload;
    } catch (error) {
      if (error instanceof CloudinaryUploadError) throw error;
      throw new CloudinaryUploadError("Không kết nối được Cloudinary");
    }

    if (!payload.secure_url?.startsWith("https://") || !payload.public_id) {
      throw new CloudinaryUploadError("Phản hồi Cloudinary không hợp lệ");
    }
    return { url: payload.secure_url, publicId: payload.public_id };
  }

  async deleteImage(publicId?: string | null): Promise<boolean> {
    if (!publicId || publicId.startsWith("local:")) {
      return true;
    }

    const { cloudName, apiKey, apiSecret } = this.getConfig();
    if (!cloudName || !apiKey || !apiSecret) {
      // Id thật mà thiếu cấu hình: không xoá được, không được báo thành công.
      return false;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.signParams(
      { public_id: publicId, timestamp },
      apiSecret
    );

    const body = new URLSearchParams({
      public_id: publicId,
      api_key: apiKey,
      timestamp: String(timestamp),
      signature,
    });

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
