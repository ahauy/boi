import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as crypto from "crypto";
import { getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
  CreditTransactionType,
} from "@palmsight/shared";
import { createTestApp, closeTestApp, TestAppInstance } from "./test-helper";
import { Reading, ReadingDocument } from "../src/schemas/reading.schema";
import { CreditTransaction, CreditTransactionDocument } from "../src/schemas/credit-transaction.schema";
import { User, UserDocument } from "../src/schemas/user.schema";

describe("T037 [US7]: Integration test for expired/invalid claimToken (backend/test/guest-trial-claim-expired.spec.ts)", () => {
  let testApp: TestAppInstance;
  let readingModel: Model<ReadingDocument>;
  let userModel: Model<UserDocument>;
  let creditTxModel: Model<CreditTransactionDocument>;

  beforeAll(async () => {
    testApp = await createTestApp();
    readingModel = testApp.app.get<Model<ReadingDocument>>(
      getModelToken(Reading.name)
    );
    userModel = testApp.app.get<Model<UserDocument>>(getModelToken(User.name));
    creditTxModel = testApp.app.get<Model<CreditTransactionDocument>>(
      getModelToken(CreditTransaction.name)
    );
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it("activates account with full 3 credits and claimFailed: true when claimToken does not exist", async () => {
    const email = "nonexistent_claim@example.com";
    const nonExistentClaimToken = "99999999-9999-4999-8999-999999999999";

    // 1. Register with non-existent claimToken (valid UUID format)
    const regRes = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "Non Existent Claim",
        username: "nonexist_user",
        email,
        password: "StrongPassword123!",
        claimToken: nonExistentClaimToken,
      }),
    });
    expect(regRes.status).toBe(202);

    const sentEmail = testApp.sentEmails.find((e) => e.to === email);
    expect(sentEmail).toBeDefined();
    const verificationToken = sentEmail!.rawToken;

    // 2. Verify email
    const verifyRes = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: verificationToken,
        claimToken: nonExistentClaimToken,
      }),
    });
    expect(verifyRes.status).toBe(200);

    const authBody = (await verifyRes.json()) as any;
    expect(authBody.user).toBeDefined();
    expect(authBody.user.creditBalance).toBe(3); // Full 3 credits preserved
    expect(authBody.claimFailed).toBe(true);
    expect(authBody.claimedReadingId).toBeNull();

    // 3. Verify database invariants
    const userInDb = await userModel.findOne({ email }).lean();
    expect(userInDb).toBeDefined();
    expect(userInDb!.creditBalance).toBe(3);

    const transactions = await creditTxModel
      .find({ userId: userInDb!._id })
      .lean();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe(CreditTransactionType.SIGNUP_BONUS);
    expect(transactions[0].amount).toBe(3);
    expect(transactions[0].balanceAfter).toBe(3);
  });

  it("activates account with full 3 credits and claimFailed: true when trial reading has expired past 7-day TTL", async () => {
    const email = "expired_claim@example.com";
    const expiredClaimToken = crypto.randomUUID();
    const guestTokenHash = crypto
      .createHash("sha256")
      .update(expiredClaimToken)
      .digest("hex");

    // 1. Manually create an expired trial reading document
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
    const [expiredReading] = await readingModel.create([
      {
        userId: null,
        isGuest: true,
        idempotencyKey: crypto.randomUUID(),
        guestTokenHash,
        school: ReadingSchool.WESTERN,
        hand: HandOrientation.LEFT,
        topics: ["lifeLine", "headLine"],
        status: ReadingStatus.GUEST_PREVIEW,
        result: {
          isPalm: true,
          school: ReadingSchool.WESTERN,
          hand: HandOrientation.LEFT,
          topics: ["lifeLine"],
          summary: "Expired summary",
          sections: [],
          aspects: {},
          advice: null,
        },
        previewExpiresAt: pastDate,
      },
    ]);

    // 2. Register with this expired claimToken
    const regRes = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "Expired Claim User",
        username: "expired_claim_u",
        email,
        password: "StrongPassword123!",
        claimToken: expiredClaimToken,
      }),
    });
    expect(regRes.status).toBe(202);

    const sentEmail = testApp.sentEmails.find((e) => e.to === email);
    expect(sentEmail).toBeDefined();
    const verificationToken = sentEmail!.rawToken;

    // 3. Verify email
    const verifyRes = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: verificationToken,
        claimToken: expiredClaimToken,
      }),
    });
    expect(verifyRes.status).toBe(200);

    const authBody = (await verifyRes.json()) as any;
    expect(authBody.user.creditBalance).toBe(3); // Full 3 credits
    expect(authBody.claimFailed).toBe(true);

    // 4. Verify DB: reading status was NOT updated to DONE, no credit deducted
    const readingAfter = await readingModel.findById(expiredReading._id).lean();
    expect(readingAfter!.status).toBe(ReadingStatus.GUEST_PREVIEW);
    expect(readingAfter!.claimedByUserId == null).toBe(true);

    const userInDb = await userModel.findOne({ email }).lean();
    const transactions = await creditTxModel
      .find({ userId: userInDb!._id })
      .lean();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe(CreditTransactionType.SIGNUP_BONUS);
  });

  it("handles malformed non-UUID claimToken in verify-email gracefully by issuing full 3 credits with claimFailed: true", async () => {
    const email = "malformed_token@example.com";
    const malformedClaimToken = "not-a-valid-uuid";

    // Register without claimToken
    const regRes = await fetch(`${testApp.baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "Malformed Token User",
        username: "bad_token_u",
        email,
        password: "StrongPassword123!",
      }),
    });
    expect(regRes.status).toBe(202);

    const sentEmail = testApp.sentEmails.find((e) => e.to === email);
    const verificationToken = sentEmail!.rawToken;

    // Verify email with non-UUID claimToken
    const verifyRes = await fetch(`${testApp.baseUrl}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: verificationToken,
        claimToken: malformedClaimToken,
      }),
    });
    expect(verifyRes.status).toBe(200);

    const authBody = (await verifyRes.json()) as any;
    expect(authBody.user.creditBalance).toBe(3);
    expect(authBody.claimFailed).toBe(true);
  });
});
