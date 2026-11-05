import { describe, it, expect, vi, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { CloudinaryService } from "../src/readings/cloudinary.service";

describe("CloudinaryService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns fallback data URI when Cloudinary credentials are not configured", async () => {
    const config = new ConfigService({});
    const service = new CloudinaryService(config);

    expect(service.isConfigured()).toBe(false);

    const sample = Buffer.from("fake-jpeg-bytes");
    const uploaded = await service.uploadImage(sample, {
      publicId: "reading_test_1",
    });

    expect(uploaded).not.toBeNull();
    expect(uploaded?.url).toBe(
      `data:image/jpeg;base64,${sample.toString("base64")}`
    );
    expect(uploaded?.publicId).toBe("local:reading_test_1");

    const deleted = await service.deleteImage(uploaded?.publicId);
    expect(deleted).toBe(true);
  });

  it("signs parameters deterministically and uploads/deletes via Cloudinary REST API when configured", async () => {
    const config = new ConfigService({
      CLOUDINARY_CLOUD_NAME: "demo-cloud",
      CLOUDINARY_API_KEY: "123456789",
      CLOUDINARY_API_SECRET: "my-secret",
      CLOUDINARY_FOLDER: "palmsight/test",
    });
    const service = new CloudinaryService(config);
    expect(service.isConfigured()).toBe(true);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          secure_url:
            "https://res.cloudinary.com/demo-cloud/image/upload/v1/palmsight/test/reading_1.jpg",
          public_id: "palmsight/test/reading_1",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: "ok" }),
      } as Response);

    const sample = Buffer.from("palm-image-content");
    const uploaded = await service.uploadImage(sample, {
      publicId: "reading_1",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(uploaded).toEqual({
      url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/palmsight/test/reading_1.jpg",
      publicId: "palmsight/test/reading_1",
    });

    const deleted = await service.deleteImage("palmsight/test/reading_1");
    expect(deleted).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  describe("production không lưu ảnh vào MongoDB", () => {
    const sample = Buffer.from("palm-image-content");
    const prodConfig = (extra: Record<string, string> = {}) =>
      new ConfigService({ NODE_ENV: "production", ...extra });
    const configured = {
      CLOUDINARY_CLOUD_NAME: "demo-cloud",
      CLOUDINARY_API_KEY: "123456789",
      CLOUDINARY_API_SECRET: "my-secret",
    };

    it("trả null khi thiếu cấu hình Cloudinary", async () => {
      const service = new CloudinaryService(prodConfig());
      await expect(
        service.uploadImage(sample, { publicId: "reading_1" })
      ).resolves.toBeNull();
    });

    it("trả null khi Cloudinary trả lỗi", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);
      const service = new CloudinaryService(prodConfig(configured));
      await expect(service.uploadImage(sample)).resolves.toBeNull();
    });

    it("trả null khi phản hồi thiếu URL", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);
      const service = new CloudinaryService(prodConfig(configured));
      await expect(service.uploadImage(sample)).resolves.toBeNull();
    });

    it("trả null khi mất kết nối", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
      const service = new CloudinaryService(prodConfig(configured));
      await expect(service.uploadImage(sample)).resolves.toBeNull();
    });
  });

  it("dev vẫn lùi về data URI khi Cloudinary trả lỗi", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const service = new CloudinaryService(
      new ConfigService({
        NODE_ENV: "development",
        CLOUDINARY_CLOUD_NAME: "demo-cloud",
        CLOUDINARY_API_KEY: "123456789",
        CLOUDINARY_API_SECRET: "my-secret",
      })
    );
    const uploaded = await service.uploadImage(Buffer.from("x"), {
      publicId: "reading_1",
    });
    expect(uploaded?.publicId).toBe("local:reading_1");
  });
});
