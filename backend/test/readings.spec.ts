import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import sharp from "sharp";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
  ImageQuality,
  PalmResult,
} from "@palmsight/shared";
import { createTestApp, closeTestApp, TestAppInstance } from "./test-helper";
import { AiService } from "../src/ai/ai.service";
import type { GoogleProfile } from "../src/auth/google-auth.verifier";

const googleProfile: GoogleProfile = {
  sub: "google-sub-readings",
  email: "readings.user@example.com",
  emailVerified: true,
  name: "Readings Tester",
  picture: null,
};

describe("US-AI-001: POST /api/v1/readings - AI Vision Palm Reading & Credit Management", () => {
  let testApp: TestAppInstance;
  let aiService: AiService;
  let accessToken: string;
  let testImageBuffer: Buffer;

  const validPalmResult: PalmResult = {
    isPalm: true,
    rejectReason: null,
    school: ReadingSchool.WESTERN,
    hand: HandOrientation.LEFT,
    imageQuality: ImageQuality.GOOD,
    topics: ["heartLine", "headLine", "love"],
    sections: [
      {
        key: "heartLine",
        title: "Đường tình cảm",
        observation: "Đường tình cảm rõ nét, dài uốn lượn nhẹ",
        meaning: "Tình cảm chân thành, sâu sắc",
      },
      {
        key: "headLine",
        title: "Đường trí tuệ",
        observation: "Đường trí tuệ thẳng và đậm",
        meaning: "Tư duy logic, quyết đoán",
      },
    ],
    aspects: {
      love: "Tình duyên êm đẹp, viên mãn",
    },
    summary: "Bàn tay hài hoà, đường nét rõ ràng mang lại nhiều cơ hội tốt.",
    advice: "Giữ tinh thần tích cực và phát huy sở trường.",
    disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
  };

  beforeAll(async () => {
    testApp = await createTestApp({
      googleVerifier: { verify: async () => googleProfile },
    });
    aiService = testApp.app.get(AiService);

    // Create a valid 100x100 JPEG image buffer
    testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 120, g: 150, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();

    // Authenticate user
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "any" }),
    });
    const body = (await res.json()) as any;
    accessToken = body.accessToken;
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  const sendReadingRequest = async (
    formFields: Record<string, string>,
    imageBuffer?: Buffer,
    idempotencyKey?: string,
    token = accessToken
  ) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(formFields)) {
      formData.append(key, value);
    }
    if (imageBuffer) {
      formData.append(
        "image",
        new Blob([imageBuffer], { type: "image/jpeg" }),
        "palm.jpg"
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (idempotencyKey !== undefined) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    return fetch(`${testApp.baseUrl}/api/v1/readings`, {
      method: "POST",
      headers,
      body: formData,
    });
  };

  it("fails with 400 IDEMPOTENCY_KEY_REQUIRED if Idempotency-Key header is missing", async () => {
    const res = await sendReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        aiConsent: "true",
      },
      testImageBuffer,
      undefined // No header
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("fails with 400 VALIDATION_ERROR if Idempotency-Key is not a valid UUID v4", async () => {
    const res = await sendReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        aiConsent: "true",
      },
      testImageBuffer,
      "invalid-uuid"
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("successfully performs reading, deducts 1 credit, and returns cached reading on duplicate key", async () => {
    const idempotencyKey = "11111111-2222-4444-8888-999999999999";
    vi.spyOn(aiService, "readPalm").mockResolvedValue({
      result: validPalmResult,
      provider: "groq",
      model: "qwen/qwen3.8-27b",
    });

    // 1st request: Successful reading
    const res = await sendReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        aiConsent: "true",
        topics: "heartLine,headLine,love",
      },
      testImageBuffer,
      idempotencyKey
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.reading.status).toBe(ReadingStatus.DONE);
    expect(body.reading.school).toBe(ReadingSchool.WESTERN);
    expect(body.reading.result).toBeDefined();
    expect(body.creditBalance).toBe(2); // 3 initial - 1 spent

    // 2nd request with exact same Idempotency-Key: Must return cached result with Idempotent-Replayed: true
    const replayedRes = await sendReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        aiConsent: "true",
      },
      testImageBuffer,
      idempotencyKey
    );

    expect(replayedRes.status).toBe(201);
    expect(replayedRes.headers.get("Idempotent-Replayed")).toBe("true");
    const replayedBody = (await replayedRes.json()) as any;
    expect(replayedBody.reading.id).toBe(body.reading.id);
    expect(replayedBody.creditBalance).toBe(2); // Not charged again
  });

  it("refunds credit (+1) when AI rejects image (isPalm = false)", async () => {
    const idempotencyKey = "22222222-3333-4444-8888-000000000000";
    vi.spyOn(aiService, "readPalm").mockResolvedValue({
      result: {
        isPalm: false,
        rejectReason: "Không nhìn rõ lòng bàn tay. Hãy chụp lại nơi đủ sáng.",
        school: null as any,
        hand: null as any,
        imageQuality: null as any,
        topics: null as any,
        sections: null as any,
        aspects: null as any,
        summary: null as any,
        advice: null as any,
        disclaimer: null as any,
      },
      provider: "groq",
      model: "qwen/qwen3.8-27b",
    });

    const res = await sendReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        aiConsent: "true",
      },
      testImageBuffer,
      idempotencyKey
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.reading.status).toBe(ReadingStatus.REJECTED);
    expect(body.reading.rejectReason).toContain("Không nhìn rõ lòng bàn tay");
    expect(body.creditBalance).toBe(2); // balance remains 2 (spent 1 then refunded 1)
  });

  it("refunds credit (+1) and returns 503 AI_UNAVAILABLE when AI fails", async () => {
    const idempotencyKey = "33333333-4444-4444-8888-111111111111";
    vi.spyOn(aiService, "readPalm").mockRejectedValue(
      new Error("All AI providers unavailable")
    );

    const res = await sendReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        aiConsent: "true",
      },
      testImageBuffer,
      idempotencyKey
    );

    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("AI_UNAVAILABLE");
    expect(body.error.details.refunded).toBe(true);
    expect(body.error.details.creditBalance).toBe(2); // balance remains 2
  });
});
