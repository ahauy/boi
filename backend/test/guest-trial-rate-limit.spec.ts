import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import sharp from "sharp";
import * as crypto from "crypto";
import { getModelToken } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  ReadingSchool,
  HandOrientation,
  ImageQuality,
  PalmResult,
} from "@palmsight/shared";
import { createTestApp, closeTestApp, TestAppInstance } from "./test-helper";
import { AiService } from "../src/ai/ai.service";
import { GuestTrial, GuestTrialDocument } from "../src/schemas/guest-trial.schema";

describe("T035 [US3]: Automated integration test for IP sliding rate limit (backend/test/guest-trial-rate-limit.spec.ts)", () => {
  let testApp: TestAppInstance;
  let aiService: AiService;
  let guestTrialModel: Model<GuestTrialDocument>;
  let testImageBuffer: Buffer;

  const validPalmResult: PalmResult = {
    isPalm: true,
    rejectReason: null,
    school: ReadingSchool.WESTERN,
    hand: HandOrientation.LEFT,
    imageQuality: ImageQuality.GOOD,
    topics: ["lifeLine", "headLine"],
    sections: [
      {
        key: "lifeLine",
        title: "Đường Sinh Đạo (Life Line)",
        observation: "Đường cong sâu, rõ nét.",
        meaning: "Thể chất dẻo dai.",
      },
      {
        key: "headLine",
        title: "Đường Trí Đạo (Head Line)",
        observation: "Đường trí đạo dài và sâu.",
        meaning: "Tư duy sáng suốt.",
      },
    ],
    aspects: {},
    summary: "Bàn tay giàu năng lượng.",
    advice: "Giữ tinh thần tích cực.",
    disclaimer: "Kết quả mang tính giải trí.",
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    aiService = testApp.app.get(AiService);
    guestTrialModel = testApp.app.get<Model<GuestTrialDocument>>(
      getModelToken(GuestTrial.name)
    );

    testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 100, g: 120, b: 180 },
      },
    })
      .jpeg()
      .toBuffer();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  const sendTrialRequestFromIp = async (
    ip: string,
    fingerprint: string,
    idempotencyKey = crypto.randomUUID()
  ) => {
    const formData = new FormData();
    formData.append("school", ReadingSchool.WESTERN);
    formData.append("hand", HandOrientation.LEFT);
    formData.append("topics", "lifeLine,headLine");
    formData.append("fingerprint", fingerprint);
    formData.append("aiConsent", "true");
    formData.append(
      "image",
      new Blob([testImageBuffer], { type: "image/jpeg" }),
      "palm.jpg"
    );

    return fetch(`${testApp.baseUrl}/api/v1/readings/guest`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
        "x-forwarded-for": ip,
      },
      body: formData,
    });
  };

  it("permits up to 5 successful trials within 24 hours per IP and blocks 6th with 429 IP_TRIAL_LIMIT_EXCEEDED", async () => {
    vi.spyOn(aiService, "readPalm").mockResolvedValue({
      result: validPalmResult,
      provider: "groq",
      model: "qwen/qwen3.8-27b",
    });

    const testIp = "203.0.113.88";

    // First 5 requests from same IP with different fingerprints should succeed
    for (let i = 1; i <= 5; i++) {
      const res = await sendTrialRequestFromIp(testIp, `fp_rate_limit_unique_${i}`);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.reading).toBeDefined();
      expect(body.claimToken).toBeDefined();
    }

    // 6th request from the same IP must be rejected with 429 IP_TRIAL_LIMIT_EXCEEDED
    const blockedRes = await sendTrialRequestFromIp(
      testIp,
      "fp_rate_limit_unique_6"
    );
    expect(blockedRes.status).toBe(429);
    const blockedBody = (await blockedRes.json()) as any;
    expect(blockedBody.error.code).toBe("IP_TRIAL_LIMIT_EXCEEDED");
    expect(blockedBody.error.message).toContain("Địa chỉ mạng của bạn đã đạt giới hạn 5 lượt bói thử");

    // A different IP should NOT be blocked and should receive 201 Created
    const differentIp = "203.0.113.99";
    const allowedRes = await sendTrialRequestFromIp(
      differentIp,
      "fp_rate_limit_unique_other_ip"
    );
    expect(allowedRes.status).toBe(201);
  });

  it("does not count trials older than 24 hours towards the sliding limit", async () => {
    vi.spyOn(aiService, "readPalm").mockResolvedValue({
      result: validPalmResult,
      provider: "groq",
      model: "qwen/qwen3.8-27b",
    });

    const slidingIp = "203.0.113.150";
    const ipHash = crypto.createHash("sha256").update(slidingIp).digest("hex");

    // Seed 5 guest trial records that are older than 24 hours (e.g. 25 hours ago)
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const oldDocs = Array.from({ length: 5 }, (_, idx) => ({
      fingerprintHash: crypto.createHash("sha256").update(`old_fp_${idx}`).digest("hex"),
      ipHash,
      guestTokenHash: crypto.createHash("sha256").update(`old_token_${idx}`).digest("hex"),
      readingId: new Types.ObjectId(),
      isClaimed: false,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      createdAt: twentyFiveHoursAgo,
    }));
    await guestTrialModel.insertMany(oldDocs);

    // Now send a request from this IP: should be allowed because previous 5 are >24h old
    const res = await sendTrialRequestFromIp(slidingIp, "fp_sliding_window_fresh_1");
    expect(res.status).toBe(201);
  });
});
