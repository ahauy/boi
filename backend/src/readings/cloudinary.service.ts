import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

export interface CloudinaryUploadOptions {
  folder?: string;
  publicId?: string;
}

@Injectable()
export class CloudinaryService {
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
      return {
        url: dataUri,
        publicId: `local:${options?.publicId || crypto.randomUUID()}`,
      };
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
        return {
          url: dataUri,
          publicId: `local:${options?.publicId || crypto.randomUUID()}`,
        };
      }

      const payload = (await response.json()) as {
        secure_url?: string;
        public_id?: string;
      };

      if (!payload.secure_url || !payload.public_id) {
        return {
          url: dataUri,
          publicId: `local:${options?.publicId || crypto.randomUUID()}`,
        };
      }

      return {
        url: payload.secure_url,
        publicId: payload.public_id,
      };
    } catch {
      return {
        url: dataUri,
        publicId: `local:${options?.publicId || crypto.randomUUID()}`,
      };
    }
  }

  async deleteImage(publicId?: string | null): Promise<boolean> {
    if (!publicId || publicId.startsWith("local:")) {
      return true;
    }

    const { cloudName, apiKey, apiSecret } = this.getConfig();
    if (!cloudName || !apiKey || !apiSecret) {
      return true;
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
