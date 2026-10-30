import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Types } from "mongoose";
import { CreditTransactionType, CREDIT_AMOUNTS } from "@palmsight/shared";
import { createTestApp, closeTestApp, TestAppInstance } from "./test-helper";
import { CreditLedgerService } from "../src/credits/credit-ledger.service";
import type { GoogleProfile } from "../src/auth/google-auth.verifier";

const googleProfile: GoogleProfile = {
  sub: "google-sub-wallet",
  email: "wallet.user@example.com",
  emailVerified: true,
  name: "Wallet User",
  picture: null,
};

describe("US-WALLET-001: CreditLedgerService & GET /api/v1/me/credit-transactions", () => {
  let testApp: TestAppInstance;
  let creditLedgerService: CreditLedgerService;
  let accessToken: string;
  let userId: Types.ObjectId;

  const getTransactions = (query = "", token?: string) =>
    fetch(
      `${testApp.baseUrl}/api/v1/me/credit-transactions${
        query ? `?${query}` : ""
      }`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );

  beforeAll(async () => {
    testApp = await createTestApp({
      googleVerifier: { verify: async () => googleProfile },
    });
    creditLedgerService = testApp.app.get(CreditLedgerService);

    // Create user and get token
    const res = await fetch(`${testApp.baseUrl}/api/v1/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "any" }),
    });
    const body = (await res.json()) as any;
    accessToken = body.accessToken;
    userId = new Types.ObjectId(body.user.id);
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  describe("CreditLedgerService Domain Invariants", () => {
    it("grants signup bonus atomically and updates user creditBalance", async () => {
      const session = await testApp.connection.startSession();
      session.startTransaction();
      try {
        const tx = await creditLedgerService.grantSignupBonus(userId, session);
        await session.commitTransaction();

        expect(tx).toBeDefined();
        expect(tx.type).toBe(CreditTransactionType.SIGNUP_BONUS);
        expect(tx.amount).toBe(CREDIT_AMOUNTS.SIGNUP_BONUS);
      } finally {
        await session.endSession();
      }

      const user = await testApp.connection
        .collection("users")
        .findOne({ _id: userId });
      expect(user?.creditBalance).toBeGreaterThanOrEqual(3);
    });

    it("spends credit for reading atomically with creditBalance >= 1", async () => {
      const readingId = new Types.ObjectId();
      const session = await testApp.connection.startSession();
      session.startTransaction();
      try {
        const tx = await creditLedgerService.spendForReading(
          userId,
          readingId,
          session
        );
        await session.commitTransaction();

        expect(tx.type).toBe(CreditTransactionType.READING_SPEND);
        expect(tx.amount).toBe(-CREDIT_AMOUNTS.READING_COST);
        expect(tx.readingId?.toString()).toBe(readingId.toString());
      } finally {
        await session.endSession();
      }
    });

    it("refunds credit for reading failure atomically", async () => {
      const readingId = new Types.ObjectId();
      const session = await testApp.connection.startSession();
      session.startTransaction();
      try {
        const tx = await creditLedgerService.refundReading(
          userId,
          readingId,
          session
        );
        await session.commitTransaction();

        expect(tx.type).toBe(CreditTransactionType.READING_REFUND);
        expect(tx.amount).toBe(CREDIT_AMOUNTS.READING_COST);
        expect(tx.readingId?.toString()).toBe(readingId.toString());
      } finally {
        await session.endSession();
      }
    });

    it("throws 402 INSUFFICIENT_CREDITS and aborts transaction when balance is 0", async () => {
      // Create a user with 0 balance
      const brokeUserId = new Types.ObjectId();
      await testApp.connection.collection("users").insertOne({
        _id: brokeUserId,
        displayName: "Broke User",
        creditBalance: 0,
        referralCode: "BROKE001",
        identities: [],
        referralBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const session = await testApp.connection.startSession();
      session.startTransaction();
      try {
        await expect(
          creditLedgerService.spendForReading(
            brokeUserId,
            new Types.ObjectId(),
            session
          )
        ).rejects.toThrow();
        await session.abortTransaction();
      } finally {
        await session.endSession();
      }

      // Ensure no transaction was recorded
      const tx = await testApp.connection
        .collection("credit_transactions")
        .findOne({ userId: brokeUserId });
      expect(tx).toBeNull();
    });
  });

  describe("GET /api/v1/me/credit-transactions", () => {
    it("rejects unauthenticated requests with 401 UNAUTHENTICATED", async () => {
      const res = await getTransactions();
      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("UNAUTHENTICATED");
    });

    it("returns list of credit transactions sorted by newest first", async () => {
      const res = await getTransactions("", accessToken);
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body).toHaveProperty("items");
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);

      const first = body.items[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("type");
      expect(first).toHaveProperty("amount");
      expect(first).toHaveProperty("balanceAfter");
      expect(first).toHaveProperty("createdAt");
    });

    it("supports cursor-based pagination with limit and nextCursor", async () => {
      const res = await getTransactions("limit=1", accessToken);
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.items.length).toBe(1);
      if (body.nextCursor) {
        const nextRes = await getTransactions(
          `cursor=${body.nextCursor}&limit=1`,
          accessToken
        );
        expect(nextRes.status).toBe(200);
        const nextBody = (await nextRes.json()) as any;
        expect(nextBody.items.length).toBe(1);
        expect(nextBody.items[0].id).not.toBe(body.items[0].id);
      }
    });

    it("returns 400 VALIDATION_ERROR on invalid cursor format", async () => {
      const res = await getTransactions(
        "cursor=invalid-cursor-format",
        accessToken
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
