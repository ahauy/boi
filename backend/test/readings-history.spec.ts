import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Types } from "mongoose";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
  ImageQuality,
  PalmResult,
} from "@palmsight/shared";
import { createTestApp, closeTestApp, TestAppInstance } from "./test-helper";
import type { GoogleProfile } from "../src/auth/google-auth.verifier";

const googleProfileUserA: GoogleProfile = {
  sub: "google-sub-readings-history-a",
  email: "history.a@example.com",
  emailVerified: true,
  name: "User A History",
  picture: null,
};

const googleProfileUserB: GoogleProfile = {
  sub: "google-sub-readings-history-b",
  email: "history.b@example.com",
  emailVerified: true,
  name: "User B History",
  picture: null,
};

describe("US-READ-001: Readings History & Detail API (GET /readings, GET /readings/:id, DELETE /readings/:id)", () => {
  let testApp: TestAppInstance;
  let tokenUserA: string;
  let userAId: Types.ObjectId;
  let tokenUserB: string;

  const mockPalmResult: PalmResult = {
    isPalm: true,
    rejectReason: null,
    school: ReadingSchool.EASTERN,
    hand: HandOrientation.LEFT,
    imageQuality: ImageQuality.GOOD,
    topics: ["nguHanh", "thienVan", "love"],
    sections: [
      {
        key: "nguHanh",
        title: "Dáng tay ngũ hành",
        observation: "Tay Thổ vuông vức",
        meaning: "Thực tế và kiên định",
      },
    ],
    aspects: { love: "Tình cảm hài hoà" },
    summary: "Dáng tay phú quý, cuộc sống bình an.",
    advice: "Giữ tinh thần lạc quan.",
    disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
  };

  beforeAll(async () => {
    testApp = await createTestApp({
      googleVerifier: {
        verify: async (token) => {
          if (token === "token-b") return googleProfileUserB;
          return googleProfileUserA;
        },
      },
    });

    // Create User A
    const resA = await fetch(`${testApp.baseUrl}/api/v1/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "token-a" }),
    });
    const bodyA = (await resA.json()) as any;
    tokenUserA = bodyA.accessToken;
    userAId = new Types.ObjectId(bodyA.user.id);

    // Create User B
    const resB = await fetch(`${testApp.baseUrl}/api/v1/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "token-b" }),
    });
    const bodyB = (await resB.json()) as any;
    tokenUserB = bodyB.accessToken;
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  it("GET /api/v1/readings returns cursor-based paginated list of readings", async () => {
    // Seed 3 readings for User A
    const readingsCol = testApp.connection.collection("readings");
    await readingsCol.deleteMany({});

    const r1 = await readingsCol.insertOne({
      userId: userAId,
      idempotencyKey: "10000000-0000-4000-8000-000000000001",
      school: ReadingSchool.EASTERN,
      topics: ["nguHanh"],
      hand: HandOrientation.LEFT,
      status: ReadingStatus.DONE,
      result: mockPalmResult,
      createdAt: new Date("2026-10-10T10:00:00Z"),
      deletedAt: null,
    });

    const r2 = await readingsCol.insertOne({
      userId: userAId,
      idempotencyKey: "10000000-0000-4000-8000-000000000002",
      school: ReadingSchool.WESTERN,
      topics: ["heartLine"],
      hand: HandOrientation.RIGHT,
      status: ReadingStatus.FAILED,
      result: null,
      createdAt: new Date("2026-10-11T10:00:00Z"),
      deletedAt: null,
    });

    const r3 = await readingsCol.insertOne({
      userId: userAId,
      idempotencyKey: "10000000-0000-4000-8000-000000000003",
      school: ReadingSchool.VEDIC,
      topics: ["planetMounts"],
      hand: HandOrientation.LEFT,
      status: ReadingStatus.DONE,
      result: mockPalmResult,
      createdAt: new Date("2026-10-12T10:00:00Z"),
      deletedAt: null,
    });

    // Page 1: limit 2
    const resPage1 = await fetch(`${testApp.baseUrl}/api/v1/readings?limit=2`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    expect(resPage1.status).toBe(200);
    const page1Data = (await resPage1.json()) as any;
    expect(page1Data.items.length).toBe(2);
    // Ordered newest first: r3, then r2
    expect(page1Data.items[0].id).toBe(r3.insertedId.toString());
    expect(page1Data.items[0].summary).toBe(mockPalmResult.summary);
    expect(page1Data.items[1].id).toBe(r2.insertedId.toString());
    expect(page1Data.items[1].summary).toBeNull(); // FAILED reading summary is null
    expect(page1Data.nextCursor).toBe(r2.insertedId.toString());

    // Page 2: with cursor
    const resPage2 = await fetch(
      `${testApp.baseUrl}/api/v1/readings?limit=2&cursor=${page1Data.nextCursor}`,
      {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      }
    );
    expect(resPage2.status).toBe(200);
    const page2Data = (await resPage2.json()) as any;
    expect(page2Data.items.length).toBe(1);
    expect(page2Data.items[0].id).toBe(r1.insertedId.toString());
    expect(page2Data.nextCursor).toBeNull();
  });

  it("GET /api/v1/readings automatically cleans up stuck PROCESSING readings (> 2 mins) and refunds credit", async () => {
    const readingsCol = testApp.connection.collection("readings");
    const usersCol = testApp.connection.collection("users");

    // Ensure User A creditBalance is known
    await usersCol.updateOne({ _id: userAId }, { $set: { creditBalance: 3 } });

    // Insert a stuck reading (> 2 minutes old)
    const stuckTime = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
    const stuck = await readingsCol.insertOne({
      userId: userAId,
      idempotencyKey: "10000000-0000-4000-8000-000000000099",
      school: ReadingSchool.WESTERN,
      topics: ["heartLine"],
      hand: HandOrientation.LEFT,
      status: ReadingStatus.PROCESSING,
      createdAt: stuckTime,
      deletedAt: null,
    });

    const res = await fetch(`${testApp.baseUrl}/api/v1/readings`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;

    const item = data.items.find(
      (x: any) => x.id === stuck.insertedId.toString()
    );
    expect(item).toBeDefined();
    expect(item.status).toBe(ReadingStatus.FAILED);

    // Verify credit refund was applied
    const userDoc = await usersCol.findOne({ _id: userAId });
    expect(userDoc?.creditBalance).toBe(4); // 3 + 1 refunded
  });

  it("GET /api/v1/readings/:id returns reading details or 404 for non-existent / other user", async () => {
    const readingsCol = testApp.connection.collection("readings");
    const doc = await readingsCol.insertOne({
      userId: userAId,
      idempotencyKey: "10000000-0000-4000-8000-000000000101",
      school: ReadingSchool.EASTERN,
      topics: ["nguHanh", "thienVan"],
      hand: HandOrientation.LEFT,
      status: ReadingStatus.DONE,
      result: mockPalmResult,
      createdAt: new Date(),
      completedAt: new Date(),
      deletedAt: null,
    });

    // 1. Success by owner
    const resSuccess = await fetch(
      `${testApp.baseUrl}/api/v1/readings/${doc.insertedId.toString()}`,
      {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      }
    );
    expect(resSuccess.status).toBe(200);
    const successData = (await resSuccess.json()) as any;
    expect(successData.id).toBe(doc.insertedId.toString());
    expect(successData.status).toBe(ReadingStatus.DONE);
    expect(successData.result).toBeDefined();

    // 2. 404 when requested by another user (User B)
    const resOtherUser = await fetch(
      `${testApp.baseUrl}/api/v1/readings/${doc.insertedId.toString()}`,
      {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      }
    );
    expect(resOtherUser.status).toBe(404);

    // 3. 404 for invalid ObjectId
    const resInvalidId = await fetch(
      `${testApp.baseUrl}/api/v1/readings/invalid-id`,
      {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      }
    );
    expect(resInvalidId.status).toBe(404);
  });

  it("DELETE /api/v1/readings/:id soft-deletes reading with 204 No Content, prevents 409 if PROCESSING", async () => {
    const readingsCol = testApp.connection.collection("readings");

    // Case 1: Attempt to delete reading that is PROCESSING -> 409 READING_IN_PROGRESS
    const processingDoc = await readingsCol.insertOne({
      userId: userAId,
      idempotencyKey: "10000000-0000-4000-8000-000000000201",
      school: ReadingSchool.WESTERN,
      topics: ["heartLine"],
      hand: HandOrientation.LEFT,
      status: ReadingStatus.PROCESSING,
      createdAt: new Date(),
      deletedAt: null,
    });

    const resProcessing = await fetch(
      `${
        testApp.baseUrl
      }/api/v1/readings/${processingDoc.insertedId.toString()}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenUserA}` },
      }
    );
    expect(resProcessing.status).toBe(409);

    // Case 2: Delete completed reading -> 204 No Content
    const completedDoc = await readingsCol.insertOne({
      userId: userAId,
      idempotencyKey: "10000000-0000-4000-8000-000000000202",
      school: ReadingSchool.EASTERN,
      topics: ["nguHanh"],
      hand: HandOrientation.LEFT,
      status: ReadingStatus.DONE,
      result: mockPalmResult,
      createdAt: new Date(),
      completedAt: new Date(),
      deletedAt: null,
    });

    const resDelete = await fetch(
      `${
        testApp.baseUrl
      }/api/v1/readings/${completedDoc.insertedId.toString()}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenUserA}` },
      }
    );
    expect(resDelete.status).toBe(204);

    // Verify it is soft-deleted in DB: deletedAt !== null and result === null
    const inDb = await readingsCol.findOne({ _id: completedDoc.insertedId });
    expect(inDb?.deletedAt).toBeInstanceOf(Date);
    expect(inDb?.result).toBeNull();

    // Verify GET /readings/:id now returns 404
    const resGetAfterDelete = await fetch(
      `${
        testApp.baseUrl
      }/api/v1/readings/${completedDoc.insertedId.toString()}`,
      {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      }
    );
    expect(resGetAfterDelete.status).toBe(404);
  });
});
