import "reflect-metadata";
import { randomUUID } from "crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { Types } from "mongoose";
import {
  HandOrientation,
  ImageQuality,
  PalmResult,
  ReadingSchool,
  ReadingStatus,
} from "@palmsight/shared";
import { ConfigService } from "@nestjs/config";
import {
  createTestApp,
  closeTestApp,
  createGuest,
  TestAppInstance,
} from "./test-helper";
import { AiService } from "../src/ai/ai.service";
import { PalmLinesService } from "../src/palm-lines/palm-lines.service";
import { ReadingsService } from "../src/readings/readings.service";

const palmResult: PalmResult = {
  isPalm: true,
  rejectReason: null,
  school: ReadingSchool.WESTERN,
  hand: HandOrientation.LEFT,
  imageQuality: ImageQuality.GOOD,
  topics: ["heartLine"],
  sections: [
    { key: "heartLine", title: "Đường tình cảm", observation: "Rõ", meaning: "Tốt" },
  ],
  aspects: {},
  summary: "Tóm tắt",
  advice: "Lời khuyên",
  disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
};

const serviceLines = [
  { name: "life", points: [[0.6, 0.3], [0.65, 0.9]], lengthRel: 0.9, curvature: 1.2, branches: 1 },
  { name: "heart", points: [[0.1, 0.2], [0.8, 0.25]], lengthRel: 0.7, curvature: 1.05, branches: 2 },
];

function configWith(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PalmLinesService", () => {
  const enabled = configWith({
    PALM_SERVICE_URL: "https://palm.example.test/",
    PALM_SERVICE_TOKEN: "secret-token",
    PALM_SERVICE_TIMEOUT_MS: "50",
  });
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is disabled and never calls the network without URL and token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const onlyUrl = new PalmLinesService(configWith({ PALM_SERVICE_URL: "https://palm.example.test" }));
    expect(onlyUrl.isEnabled()).toBe(false);
    expect(await onlyUrl.analyze(image)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the image with the bearer token and returns sanitised lines and the decoded image", async () => {
    const annotated = Buffer.from("jpeg-bytes");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        ok: true,
        lines: [...serviceLines, { name: "bogus", points: [[5, -3], [0.5, 0.5]] }, { points: "x" }],
        annotatedImage: annotated.toString("base64"),
      })
    );

    const result = await new PalmLinesService(enabled).analyze(image);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://palm.example.test/v1/analyze");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as any).headers.Authorization).toBe("Bearer secret-token");
    expect(result?.annotatedImage?.equals(annotated)).toBe(true);
    expect(result?.lines.map((l) => l.name)).toEqual(["life", "heart", "other"]);
    // điểm ngoài khoảng 0-1 bị kẹp lại, mục không có mảng điểm bị bỏ
    expect(result?.lines[2].points[0]).toEqual([1, 0]);
  });

  it("returns null when the service skips the image", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: false, reason: "no_hand" }));
    expect(await new PalmLinesService(enabled).analyze(image)).toBeNull();
  });

  it("returns null on an HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "x" }, 500));
    expect(await new PalmLinesService(enabled).analyze(image)).toBeNull();
  });

  it("returns null on a network error or timeout instead of throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init as RequestInit).signal?.addEventListener("abort", () =>
            reject(new DOMException("timed out", "TimeoutError"))
          );
        })
    );
    expect(await new PalmLinesService(enabled).analyze(image)).toBeNull();

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    expect(await new PalmLinesService(enabled).analyze(image)).toBeNull();
  });

  it("retries once when Fly's proxy answers 503 or drops the connection while the machine boots", async () => {
    const slow = configWith({
      PALM_SERVICE_URL: "https://palm.example.test",
      PALM_SERVICE_TOKEN: "secret-token",
      PALM_SERVICE_TIMEOUT_MS: "10000",
    });
    const ok = () => jsonResponse({ ok: true, lines: serviceLines, annotatedImage: null });

    const after503 = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(ok());
    expect((await new PalmLinesService(slow).analyze(image))?.lines).toHaveLength(2);
    expect(after503).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();

    const afterDrop = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok());
    expect((await new PalmLinesService(slow).analyze(image))?.lines).toHaveLength(2);
    expect(afterDrop).toHaveBeenCalledTimes(2);
  });

  it("does not retry an ordinary HTTP error and gives up after the second 503", async () => {
    const once500 = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 500));
    expect(await new PalmLinesService(enabled).analyze(image)).toBeNull();
    expect(once500).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();

    const slow = configWith({
      PALM_SERVICE_URL: "https://palm.example.test",
      PALM_SERVICE_TOKEN: "secret-token",
      PALM_SERVICE_TIMEOUT_MS: "10000",
    });
    const always503 = vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse({}, 503));
    expect(await new PalmLinesService(slow).analyze(image)).toBeNull();
    expect(always503).toHaveBeenCalledTimes(2);
  });

  it("returns null when the body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>", { status: 200 }));
    expect(await new PalmLinesService(enabled).analyze(image)).toBeNull();
  });
});

describe("POST /api/v1/readings with palm-service", () => {
  let testApp: TestAppInstance;
  let aiService: AiService;
  let palmLinesService: PalmLinesService;
  let palmImage: Buffer;
  let annotatedJpeg: Buffer;

  beforeAll(async () => {
    testApp = await createTestApp();
    aiService = testApp.app.get(AiService);
    palmLinesService = testApp.app.get(PalmLinesService);
    palmImage = await sharp({
      create: { width: 120, height: 120, channels: 3, background: { r: 200, g: 170, b: 150 } },
    })
      .jpeg()
      .toBuffer();
    annotatedJpeg = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function postReading() {
    const { accessToken } = await createGuest(testApp);
    const form = new FormData();
    form.append("school", ReadingSchool.WESTERN);
    form.append("hand", HandOrientation.LEFT);
    form.append("aiConsent", "true");
    form.append("topics", "heartLine");
    form.append("image", new Blob([palmImage], { type: "image/jpeg" }), "palm.jpg");
    const res = await fetch(`${testApp.baseUrl}/api/v1/readings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Idempotency-Key": randomUUID() },
      body: form,
    });
    return { res, body: (await res.json()) as any };
  }

  function mockAi(result: PalmResult = palmResult) {
    vi.spyOn(aiService, "readPalm").mockResolvedValue({ result, provider: "gemini", model: "test" });
  }

  it("is disabled in tests by default, so readings work without the service", async () => {
    expect(palmLinesService.isEnabled()).toBe(false);
    mockAi();
    const { res, body } = await postReading();
    expect(res.status).toBe(201);
    expect(body.reading.status).toBe(ReadingStatus.DONE);
    expect(body.reading.annotatedImageUrl).toBeNull();
    expect(body.reading.palmLines).toBeNull();
  });

  it("saves the server-drawn lines and image, analysing the same processed image the AI reads", async () => {
    mockAi();
    const analyze = vi
      .spyOn(palmLinesService, "analyze")
      .mockResolvedValue({ lines: serviceLines as any, annotatedImage: annotatedJpeg });

    const { res, body } = await postReading();

    expect(res.status).toBe(201);
    expect(body.reading.status).toBe(ReadingStatus.DONE);
    expect(body.reading.palmLines.map((l: any) => l.name)).toEqual(["life", "heart"]);
    // Cloudinary chưa cấu hình trong test nên ảnh lưu dạng data URI
    expect(body.reading.annotatedImageUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.reading.imageUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.reading.annotatedImageUrl).not.toBe(body.reading.imageUrl);

    const sent = analyze.mock.calls[0][0] as Buffer;
    const aiImage = (vi.mocked(aiService.readPalm).mock.calls[0][0] as string).replace(
      /^data:image\/jpeg;base64,/,
      ""
    );
    expect(sent.toString("base64")).toBe(aiImage);

    const doc = await testApp.connection
      .collection("readings")
      .findOne({ _id: new Types.ObjectId(body.reading.id) });
    expect(doc?.annotatedImagePublicId).toBe(`local:reading_${body.reading.id}_lines`);
  });

  it("still completes the reading without a refund when the service fails", async () => {
    mockAi();
    vi.spyOn(palmLinesService, "analyze").mockRejectedValue(new Error("boom"));

    const { res, body } = await postReading();

    expect(res.status).toBe(201);
    expect(body.reading.status).toBe(ReadingStatus.DONE);
    expect(body.reading.annotatedImageUrl).toBeNull();
    expect(body.creditBalance).toBe(2); // 3 khởi đầu - 1, không hoàn
  });

  it("completes without lines when the service finds no hand", async () => {
    mockAi();
    vi.spyOn(palmLinesService, "analyze").mockResolvedValue(null);

    const { res, body } = await postReading();

    expect(res.status).toBe(201);
    expect(body.reading.status).toBe(ReadingStatus.DONE);
    expect(body.reading.annotatedImageUrl).toBeNull();
    expect(body.reading.palmLines).toBeNull();
  });

  it("uploads nothing when the AI rejects the image", async () => {
    mockAi({ ...palmResult, isPalm: false, rejectReason: "Không phải lòng bàn tay" });
    vi.spyOn(palmLinesService, "analyze").mockResolvedValue({
      lines: serviceLines as any,
      annotatedImage: annotatedJpeg,
    });
    const cloudinary = (testApp.app.get(ReadingsService) as any).cloudinary;
    const upload = vi.spyOn(cloudinary, "uploadImage");

    const { res, body } = await postReading();

    expect(res.status).toBe(201);
    expect(body.reading.status).toBe(ReadingStatus.REJECTED);
    expect(body.reading.annotatedImageUrl).toBeNull();
    expect(body.reading.palmLines).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });
});
