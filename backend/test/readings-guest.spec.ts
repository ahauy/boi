import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import sharp from "sharp";
import * as crypto from "crypto";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
  ImageQuality,
  PalmResult,
} from "@palmsight/shared";
import { createTestApp, closeTestApp, TestAppInstance } from "./test-helper";
import { AiService } from "../src/ai/ai.service";

describe("US-GUEST-001: Guest Trial Reading Endpoints & Claim Flow (TC-016..TC-020)", () => {
  let testApp: TestAppInstance;
  let aiService: AiService;
  let testImageBuffer: Buffer;
  let firstTrialClaimToken: string;
  let firstTrialCookie: string;
  let firstTrialReadingId: string;
  const uniqueFingerprint = "test_fp_device_unique_1234567890";

  const validPalmResult: PalmResult = {
    isPalm: true,
    rejectReason: null,
    school: ReadingSchool.WESTERN,
    hand: HandOrientation.LEFT,
    imageQuality: ImageQuality.GOOD,
    topics: ["lifeLine", "headLine", "heartLine", "career", "love"],
    sections: [
      {
        key: "lifeLine",
        title: "Đường Sinh Đạo (Life Line)",
        observation: "Đường cong sâu, rõ, không đứt đoạn.",
        meaning: "Thể chất dẻo dai và năng lượng dồi dào.",
      },
      {
        key: "headLine",
        title: "Đường Trí Đạo (Head Line)",
        observation: "Đường trí đạo thẳng và dài.",
        meaning: "Tư duy logic, thực tế.",
      },
      {
        key: "heartLine",
        title: "Đường Tâm Đạo (Heart Line)",
        observation: "Đường tâm đạo sâu.",
        meaning: "Giàu cảm xúc.",
      },
    ],
    aspects: {
      career: "Sự nghiệp phát triển mạnh mẽ.",
      love: "Tình duyên viên mãn.",
    },
    summary: "Bàn tay mang năng lượng Thổ với đường sinh đạo sâu và rõ nét...",
    advice: "Giữ tinh thần tích cực và phát huy sở trường.",
    disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    aiService = testApp.app.get(AiService);

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
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  const sendGuestReadingRequest = async (
    formFields: Record<string, string>,
    imageBuffer?: Buffer,
    idempotencyKey = crypto.randomUUID(),
    cookieHeader?: string
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

    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }
    if (formFields.fingerprint) {
      headers["x-fingerprint"] = formFields.fingerprint;
    }

    return fetch(`${testApp.baseUrl}/api/v1/readings/guest`, {
      method: "POST",
      headers,
      body: formData,
    });
  };

  it("TC-016: Happy Path - First-time guest trial returns 201 Created with 50% truncated preview and sets cookie", async () => {
    vi.spyOn(aiService, "readPalm").mockResolvedValueOnce({
      result: validPalmResult,
      provider: "groq",
      model: "qwen/qwen3.8-27b",
    });

    const res = await sendGuestReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        topics: "lifeLine,headLine,heartLine,career,love",
        fingerprint: uniqueFingerprint,
        aiConsent: "true",
      },
      testImageBuffer
    );

    expect(res.status).toBe(201);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("ps_guest_trial=");
    firstTrialCookie = setCookie!.split(";")[0];

    const body = (await res.json()) as any;
    expect(body.reading).toBeDefined();
    expect(body.claimToken).toBeDefined();
    firstTrialClaimToken = body.claimToken;
    firstTrialReadingId = body.reading.id;

    // Check 50% server truncation
    expect(body.reading.status).toBe(ReadingStatus.GUEST_PREVIEW);
    expect(body.reading.summary).toBe(validPalmResult.summary);
    expect(body.reading.sections).toHaveLength(3);

    // First 2 sections are unlocked
    expect(body.reading.sections[0].isLocked).toBe(false);
    expect(body.reading.sections[0].observation).toBe(
      validPalmResult.sections![0].observation
    );
    expect(body.reading.sections[1].isLocked).toBe(false);
    expect(body.reading.sections[1].observation).toBe(
      validPalmResult.sections![1].observation
    );

    // Section 3 is locked with null observation & meaning
    expect(body.reading.sections[2].isLocked).toBe(true);
    expect(body.reading.sections[2].observation).toBeNull();
    expect(body.reading.sections[2].meaning).toBeNull();

    // Aspects and advice are locked with null content
    expect(body.reading.aspects.career.isLocked).toBe(true);
    expect(body.reading.aspects.career.content).toBeNull();
    expect(body.reading.aspects.love.isLocked).toBe(true);
    expect(body.reading.aspects.love.content).toBeNull();
    expect(body.reading.advice.isLocked).toBe(true);
    expect(body.reading.advice.content).toBeNull();
  });

  it("TC-017: Blocks second trial attempt on same browser when cookie is present (403 GUEST_TRIAL_LIMIT_REACHED)", async () => {
    const res = await sendGuestReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        topics: "lifeLine,headLine",
        fingerprint: "different_fp_device_456789",
        aiConsent: "true",
      },
      testImageBuffer,
      crypto.randomUUID(),
      firstTrialCookie
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("GUEST_TRIAL_LIMIT_REACHED");
  });

  it("TC-018: Blocks second trial in incognito tab with same fingerprint (403 GUEST_TRIAL_LIMIT_REACHED)", async () => {
    // No cookie sent, but matching fingerprint
    const res = await sendGuestReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        topics: "lifeLine,headLine",
        fingerprint: uniqueFingerprint,
        aiConsent: "true",
      },
      testImageBuffer
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("GUEST_TRIAL_LIMIT_REACHED");
  });

  it("TC-009: When AI reports isPalm = false, returns 200 OK with REJECTED and does not consume trial", async () => {
    vi.spyOn(aiService, "readPalm").mockResolvedValueOnce({
      result: {
        isPalm: false,
        rejectReason: "Không nhận diện được lòng bàn tay",
      },
      provider: "groq",
      model: "qwen/qwen3.8-27b",
    });

    const notPalmFp = "cat_photo_uploader_fp_99999999";
    const res = await sendGuestReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        fingerprint: notPalmFp,
        aiConsent: "true",
      },
      testImageBuffer
    );

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeNull();

    const body = (await res.json()) as any;
    expect(body.reading.status).toBe(ReadingStatus.REJECTED);
    expect(body.reading.rejectReason).toContain("Không nhận diện được lòng bàn tay");

    // Can immediately retry with same fingerprint because trial was NOT consumed
    vi.spyOn(aiService, "readPalm").mockResolvedValueOnce({
      result: validPalmResult,
      provider: "groq",
      model: "qwen/qwen3.8-27b",
    });
    const retryRes = await sendGuestReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        fingerprint: notPalmFp,
        aiConsent: "true",
      },
      testImageBuffer
    );

    expect(retryRes.status).toBe(201);
  });

  it("TC-020: GET /api/v1/readings/guest/:token returns 200 OK with 50% preview within 7 days", async () => {
    const res = await fetch(
      `${testApp.baseUrl}/api/v1/readings/guest/${firstTrialClaimToken}`
    );

    expect(res.status).toBe(200);
    const preview = (await res.json()) as any;
    expect(preview.id).toBe(firstTrialReadingId);
    expect(preview.status).toBe(ReadingStatus.GUEST_PREVIEW);
    expect(preview.sections[0].isLocked).toBe(false);
    expect(preview.sections[2].isLocked).toBe(true);
    expect(preview.aspects.career.content).toBeNull();
  });

  it("returns 404 NOT_FOUND when GET /api/v1/readings/guest/:token with non-existent claim token", async () => {
    const fakeToken = "00000000-0000-4000-8000-000000000000";
    const res = await fetch(
      `${testApp.baseUrl}/api/v1/readings/guest/${fakeToken}`
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("TC-012: Full Flow - Register and verify email with claimToken: grants 3, spends 1, balance = 2, unlocks reading to DONE", async () => {
    // 1. Register with claimToken
    const email = "claimed_guest@example.com";
    const regRes = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "Claimed Guest",
        username: "claimed_guest",
        email,
        password: "StrongPassword123!",
        claimToken: firstTrialClaimToken,
      }),
    });
    expect(regRes.status).toBe(202);

    // Retrieve sent verification rawToken
    const sentEmail = testApp.sentEmails.find((e) => e.to === email);
    expect(sentEmail).toBeDefined();
    const verificationToken = sentEmail!.rawToken;

    // 2. Verify email with claimToken
    const verifyRes = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: verificationToken,
        claimToken: firstTrialClaimToken,
      }),
    });
    expect(verifyRes.status).toBe(200);

    const authBody = (await verifyRes.json()) as any;
    expect(authBody.user.creditBalance).toBe(2); // 3 bonus - 1 claim spend = 2
    expect(authBody.claimedReadingId).toBe(firstTrialReadingId);

    // 3. User can now view full 100% reading via GET /api/v1/readings/:id
    const readingRes = await fetch(
      `${testApp.baseUrl}/api/v1/readings/${firstTrialReadingId}`,
      {
        headers: {
          Authorization: `Bearer ${authBody.accessToken}`,
        },
      }
    );
    expect(readingRes.status).toBe(200);
    const readingBody = (await readingRes.json()) as any;
    expect(readingBody.status).toBe(ReadingStatus.DONE);
    // All sections observation and meaning are 100% available in result
    expect(readingBody.result.sections[2].observation).toBe(
      validPalmResult.sections![2].observation
    );
    expect(readingBody.result.aspects.career).toBe(
      validPalmResult.aspects!.career
    );
  });

  it("TC-021: Idempotency replay returns 201 with Idempotent-Replayed: true header and existing preview", async () => {
    const customKey = crypto.randomUUID();
    const customFp = "fp_idempotent_guest_test_123456";

    vi.spyOn(aiService, "readPalm").mockResolvedValueOnce({
      result: validPalmResult,
      provider: "groq",
      model: "qwen/qwen3.8-27b",
    });

    const res1 = await sendGuestReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        topics: "lifeLine,headLine",
        fingerprint: customFp,
        aiConsent: "true",
      },
      testImageBuffer,
      customKey
    );
    expect(res1.status).toBe(201);
    expect(res1.headers.get("Idempotent-Replayed")).toBeNull();
    const body1 = (await res1.json()) as any;

    // Second request with exact same idempotencyKey
    const res2 = await sendGuestReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        topics: "lifeLine,headLine",
        fingerprint: customFp,
        aiConsent: "true",
      },
      testImageBuffer,
      customKey
    );
    expect(res2.status).toBe(201);
    expect(res2.headers.get("Idempotent-Replayed")).toBe("true");
    const body2 = (await res2.json()) as any;
    expect(body2.reading.id).toBe(body1.reading.id);
  });

  it("TC-022: Concurrent request with same idempotency-key while processing returns 409 Conflict with READING_IN_PROGRESS", async () => {
    const inProgressKey = crypto.randomUUID();
    await testApp.connection.collection("readings").insertOne({
      userId: null,
      isGuest: true,
      idempotencyKey: inProgressKey,
      school: ReadingSchool.WESTERN,
      hand: HandOrientation.LEFT,
      topics: ["lifeLine"],
      status: ReadingStatus.PROCESSING,
      createdAt: new Date(),
    });

    const res = await sendGuestReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        topics: "lifeLine",
        fingerprint: "fp_in_progress_device_123456",
        aiConsent: "true",
      },
      testImageBuffer,
      inProgressKey
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("READING_IN_PROGRESS");
    expect(body.error.message).toBe("Lần xem bói trước vẫn đang xử lý.");
  });

  it("TC-023: AI failure updates reading to FAILED and returns 502 Bad Gateway with AI_SERVICE_UNAVAILABLE", async () => {
    const aiFailKey = crypto.randomUUID();
    const aiFailFp = "fp_ai_failure_test_device_123456";

    vi.spyOn(aiService, "readPalm").mockRejectedValueOnce(
      new Error("AI Groq Connection Timeout")
    );

    const res = await sendGuestReadingRequest(
      {
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        topics: "lifeLine",
        fingerprint: aiFailFp,
        aiConsent: "true",
      },
      testImageBuffer,
      aiFailKey
    );

    expect(res.status).toBe(502);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("AI_SERVICE_UNAVAILABLE");
    expect(body.error.message).toBe(
      "Hệ thống AI đang bận. Vui lòng thử lại sau ít phút!"
    );

    const saved = await testApp.connection
      .collection("readings")
      .findOne({ idempotencyKey: aiFailKey, isGuest: true });
    expect(saved).toBeDefined();
    expect(saved?.status).toBe(ReadingStatus.FAILED);
    expect(saved?.errorCode).toBe("AI_SERVICE_UNAVAILABLE");
  });
});
