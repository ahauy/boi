import { describe, it, expect, beforeAll } from "vitest";
import { ImageProcessorService } from "../src/readings/image-processor.service";

describe("US-SCAN-002: In-Memory Image Preprocessing & Validation", () => {
  let imageProcessorService: ImageProcessorService;

  beforeAll(() => {
    imageProcessorService = new ImageProcessorService();
  });

  it("rejects files larger than 8MB with 413 IMAGE_TOO_LARGE", async () => {
    const fakeOversizedFile: Express.Multer.File = {
      fieldname: "image",
      originalname: "huge.jpg",
      encoding: "7bit",
      mimetype: "image/jpeg",
      size: 9 * 1024 * 1024, // 9MB > 8MB
      buffer: Buffer.alloc(10), // mock buffer
      destination: "",
      filename: "",
      path: "",
      stream: null as any,
    };

    await expect(
      imageProcessorService.validateAndProcess(fakeOversizedFile)
    ).rejects.toMatchObject({
      status: 413,
      response: {
        code: "IMAGE_TOO_LARGE",
      },
    });
  });

  it("rejects unsupported non-image files with 415 UNSUPPORTED_IMAGE_TYPE", async () => {
    const textFile: Express.Multer.File = {
      fieldname: "image",
      originalname: "document.txt",
      encoding: "7bit",
      mimetype: "text/plain",
      size: 100,
      buffer: Buffer.from("This is a plain text file, not an image."),
      destination: "",
      filename: "",
      path: "",
      stream: null as any,
    };

    await expect(
      imageProcessorService.validateAndProcess(textFile)
    ).rejects.toMatchObject({
      status: 415,
      response: {
        code: "UNSUPPORTED_IMAGE_TYPE",
      },
    });
  });

  it("rejects missing file with 400 VALIDATION_ERROR", async () => {
    await expect(
      imageProcessorService.validateAndProcess(undefined as any)
    ).rejects.toMatchObject({
      status: 400,
      response: {
        code: "VALIDATION_ERROR",
      },
    });
  });

  it("successfully processes, resizes (>1280px to 1280px), and compresses valid image to JPEG", async () => {
    // Generate a 1600x1200 red image buffer
    const sharp = (await import("sharp")).default;
    const inputBuffer = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 200, g: 50, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const mockFile: Express.Multer.File = {
      fieldname: "image",
      originalname: "palm-sample.png",
      encoding: "7bit",
      mimetype: "image/png",
      size: inputBuffer.length,
      buffer: inputBuffer,
      destination: "",
      filename: "",
      path: "",
      stream: null as any,
    };

    const result = await imageProcessorService.validateAndProcess(mockFile);

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.width).toBe(1280);
    expect(result.height).toBe(960);
    expect(result.base64).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.size).toBe(result.buffer.length);

    // Verify output buffer is indeed a valid JPEG and has stripped EXIF
    const outputMeta = await sharp(result.buffer).metadata();
    expect(outputMeta.format).toBe("jpeg");
    expect(outputMeta.exif).toBeUndefined();
  });
});
