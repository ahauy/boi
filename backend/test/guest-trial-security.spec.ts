import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import sharp from "sharp";
import * as crypto from "crypto";
import {
  ReadingSchool,
  HandOrientation,
  ImageQuality,
  PalmResult,
  ReadingStatus,
} from "@palmsight/shared";
import { createTestApp, closeTestApp, TestAppInstance } from "./test-helper";
import { AiService } from "../src/ai/ai.service";

describe("T036 [US1]: Security payload audit test (backend/test/guest-trial-security.spec.ts)", () => {
  let testApp: TestAppInstance;
  let aiService: AiService;
  let testImageBuffer: Buffer;

  const CANARY_TOKENS = {
    UNLOCKED_OBS_1: "UNLOCKED_CANARY_PUBLIC_OBSERVATION_1",
    UNLOCKED_MEANING_1: "UNLOCKED_CANARY_PUBLIC_MEANING_1",
    UNLOCKED_OBS_2: "UNLOCKED_CANARY_PUBLIC_OBSERVATION_2",
    UNLOCKED_MEANING_2: "UNLOCKED_CANARY_PUBLIC_MEANING_2",
    LOCKED_OBS_3: "CANARY_SENSITIVE_LOCKED_OBSERVATION_SECTION_3",
    LOCKED_MEANING_3: "CANARY_SENSITIVE_LOCKED_MEANING_SECTION_3",
    LOCKED_OBS_4: "CANARY_SENSITIVE_LOCKED_OBSERVATION_SECTION_4",
    LOCKED_MEANING_4: "CANARY_SENSITIVE_LOCKED_MEANING_SECTION_4",
    LOCKED_ASPECT_CAREER: "CANARY_SENSITIVE_LOCKED_ASPECT_CAREER_CONTENT",
    LOCKED_ASPECT_LOVE: "CANARY_SENSITIVE_LOCKED_ASPECT_LOVE_CONTENT",
    LOCKED_ADVICE: "CANARY_SENSITIVE_LOCKED_ADVICE_CONTENT_SECRET",
  };

  const sensitivePalmResult: PalmResult = {
    isPalm: true,
    rejectReason: null,
    school: ReadingSchool.WESTERN,
    hand: HandOrientation.LEFT,
    imageQuality: ImageQuality.GOOD,
    topics: ["lifeLine", "headLine", "heartLine", "fateLine", "career", "love"],
    summary: "Bàn tay mang năng lượng vũ trụ với đường sinh đạo sâu và rõ nét...",
    sections: [
      {
        key: "lifeLine",
        title: "Đường Sinh Đạo (Life Line)",
        observation: CANARY_TOKENS.UNLOCKED_OBS_1,
        meaning: CANARY_TOKENS.UNLOCKED_MEANING_1,
      },
      {
        key: "headLine",
        title: "Đường Trí Đạo (Head Line)",
        observation: CANARY_TOKENS.UNLOCKED_OBS_2,
        meaning: CANARY_TOKENS.UNLOCKED_MEANING_2,
      },
      {
        key: "heartLine",
        title: "Đường Tâm Đạo (Heart Line)",
        observation: CANARY_TOKENS.LOCKED_OBS_3,
        meaning: CANARY_TOKENS.LOCKED_MEANING_3,
      },
      {
        key: "fateLine",
        title: "Đường Định Mệnh (Fate Line)",
        observation: CANARY_TOKENS.LOCKED_OBS_4,
        meaning: CANARY_TOKENS.LOCKED_MEANING_4,
      },
    ],
    aspects: {
      career: CANARY_TOKENS.LOCKED_ASPECT_CAREER,
      love: CANARY_TOKENS.LOCKED_ASPECT_LOVE,
    },
    advice: CANARY_TOKENS.LOCKED_ADVICE,
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
        background: { r: 140, g: 160, b: 210 },
      },
    })
      .jpeg()
      .toBuffer();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it("verifies 0% sensitive locked text leak in POST /api/v1/readings/guest response payload", async () => {
    vi.spyOn(aiService, "readPalm").mockResolvedValueOnce({
      result: sensitivePalmResult,
      provider: "groq",
      model: "qwen/qwen3.8-27b",
    });

    const formData = new FormData();
    formData.append("school", ReadingSchool.WESTERN);
    formData.append("hand", HandOrientation.LEFT);
    formData.append(
      "topics",
      "lifeLine,headLine,heartLine,fateLine,career,love"
    );
    formData.append("fingerprint", "fp_security_audit_test_device_999");
    formData.append("aiConsent", "true");
    formData.append(
      "image",
      new Blob([testImageBuffer], { type: "image/jpeg" }),
      "palm.jpg"
    );

    const res = await fetch(`${testApp.baseUrl}/api/v1/readings/guest`, {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: formData,
    });

    expect(res.status).toBe(201);
    const rawText = await res.text();

    // 1. Audit raw response body: ZERO leak of sensitive canary tokens
    expect(rawText).not.toContain(CANARY_TOKENS.LOCKED_OBS_3);
    expect(rawText).not.toContain(CANARY_TOKENS.LOCKED_MEANING_3);
    expect(rawText).not.toContain(CANARY_TOKENS.LOCKED_OBS_4);
    expect(rawText).not.toContain(CANARY_TOKENS.LOCKED_MEANING_4);
    expect(rawText).not.toContain(CANARY_TOKENS.LOCKED_ASPECT_CAREER);
    expect(rawText).not.toContain(CANARY_TOKENS.LOCKED_ASPECT_LOVE);
    expect(rawText).not.toContain(CANARY_TOKENS.LOCKED_ADVICE);

    // Also verify no internal database hashes leak in response
    expect(rawText).not.toContain("guestTokenHash");
    expect(rawText).not.toContain("ipHash");
    expect(rawText).not.toContain("fingerprintHash");

    // 2. Unlocked content must be intact
    expect(rawText).toContain(CANARY_TOKENS.UNLOCKED_OBS_1);
    expect(rawText).toContain(CANARY_TOKENS.UNLOCKED_MEANING_1);
    expect(rawText).toContain(CANARY_TOKENS.UNLOCKED_OBS_2);
    expect(rawText).toContain(CANARY_TOKENS.UNLOCKED_MEANING_2);

    // 3. Inspect deserialized JSON payload structure
    const body = JSON.parse(rawText);
    expect(body.reading).toBeDefined();
    expect(body.claimToken).toBeDefined();
    expect(body.reading.status).toBe(ReadingStatus.GUEST_PREVIEW);

    // Sections 0 & 1 unlocked
    expect(body.reading.sections[0].isLocked).toBe(false);
    expect(body.reading.sections[0].observation).toBe(CANARY_TOKENS.UNLOCKED_OBS_1);
    expect(body.reading.sections[1].isLocked).toBe(false);
    expect(body.reading.sections[1].observation).toBe(CANARY_TOKENS.UNLOCKED_OBS_2);

    // Sections 2 & 3 locked with explicit nulls
    expect(body.reading.sections[2].isLocked).toBe(true);
    expect(body.reading.sections[2].observation).toBeNull();
    expect(body.reading.sections[2].meaning).toBeNull();

    expect(body.reading.sections[3].isLocked).toBe(true);
    expect(body.reading.sections[3].observation).toBeNull();
    expect(body.reading.sections[3].meaning).toBeNull();

    // Aspects locked with explicit nulls
    expect(body.reading.aspects.career.isLocked).toBe(true);
    expect(body.reading.aspects.career.content).toBeNull();
    expect(body.reading.aspects.love.isLocked).toBe(true);
    expect(body.reading.aspects.love.content).toBeNull();

    // Advice locked with explicit null
    expect(body.reading.advice.isLocked).toBe(true);
    expect(body.reading.advice.content).toBeNull();
  });

  it("verifies 0% sensitive locked text leak in GET /api/v1/readings/guest/:token response payload", async () => {
    vi.spyOn(aiService, "readPalm").mockResolvedValueOnce({
      result: sensitivePalmResult,
      provider: "groq",
      model: "qwen/qwen3.8-27b",
    });

    const formData = new FormData();
    formData.append("school", ReadingSchool.WESTERN);
    formData.append("hand", HandOrientation.LEFT);
    formData.append("topics", "lifeLine,headLine,heartLine,career");
    formData.append("fingerprint", "fp_security_audit_test_device_888");
    formData.append("aiConsent", "true");
    formData.append(
      "image",
      new Blob([testImageBuffer], { type: "image/jpeg" }),
      "palm.jpg"
    );

    const postRes = await fetch(`${testApp.baseUrl}/api/v1/readings/guest`, {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: formData,
    });
    expect(postRes.status).toBe(201);
    const postBody = (await postRes.json()) as any;
    const claimToken = postBody.claimToken;

    // Fetch via GET /api/v1/readings/guest/:token
    const getRes = await fetch(
      `${testApp.baseUrl}/api/v1/readings/guest/${claimToken}`
    );
    expect(getRes.status).toBe(200);

    const rawGetText = await getRes.text();

    // ZERO leak of sensitive canary tokens
    expect(rawGetText).not.toContain(CANARY_TOKENS.LOCKED_OBS_3);
    expect(rawGetText).not.toContain(CANARY_TOKENS.LOCKED_MEANING_3);
    expect(rawGetText).not.toContain(CANARY_TOKENS.LOCKED_ASPECT_CAREER);
    expect(rawGetText).not.toContain(CANARY_TOKENS.LOCKED_ADVICE);
    expect(rawGetText).not.toContain("guestTokenHash");

    // Unlocked text is present
    expect(rawGetText).toContain(CANARY_TOKENS.UNLOCKED_OBS_1);
    expect(rawGetText).toContain(CANARY_TOKENS.UNLOCKED_OBS_2);

    const preview = JSON.parse(rawGetText);
    expect(preview.sections[2].isLocked).toBe(true);
    expect(preview.sections[2].observation).toBeNull();
    expect(preview.sections[2].meaning).toBeNull();
    expect(preview.aspects.career.isLocked).toBe(true);
    expect(preview.aspects.career.content).toBeNull();
    expect(preview.advice.isLocked).toBe(true);
    expect(preview.advice.content).toBeNull();
  });
});
