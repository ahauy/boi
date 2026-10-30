import { describe, it, expect } from "vitest";
import {
  ReadingSchool,
  HandOrientation,
  HandSide,
  createReadingRequestSchema,
  normalizeReadingTopics,
  getAllSchoolTopics,
} from "./index";

describe("US-SCAN-001: ReadingSchool, HandSide & createReadingRequestSchema", () => {
  describe("Enums & Aliases", () => {
    it("should export HandSide identical to HandOrientation", () => {
      expect(HandSide.LEFT).toBe(HandOrientation.LEFT);
      expect(HandSide.RIGHT).toBe(HandOrientation.RIGHT);
      expect(HandSide.LEFT).toBe("LEFT");
      expect(HandSide.RIGHT).toBe("RIGHT");
    });

    it("should support all 3 ReadingSchool values", () => {
      expect(Object.values(ReadingSchool)).toEqual([
        "WESTERN",
        "EASTERN",
        "VEDIC",
      ]);
    });
  });

  describe("Topic Normalization (normalizeReadingTopics)", () => {
    it("returns all topics in canonical order when topics is empty or undefined (bói toàn bộ)", () => {
      const westernAll = normalizeReadingTopics(ReadingSchool.WESTERN);
      expect(westernAll).toContain("handShape");
      expect(westernAll).toContain("heartLine");
      expect(westernAll).toContain("love");
      expect(westernAll).toContain("family");
      expect(westernAll.length).toBe(7 + 6); // 7 sections + 6 aspects

      const easternAll = normalizeReadingTopics(ReadingSchool.EASTERN, "");
      expect(easternAll).toContain("nguHanh");
      expect(easternAll).toContain("thienVan");
      expect(easternAll).toContain("personality");
      expect(easternAll.length).toBe(6 + 6); // 6 sections + 6 aspects
    });

    it("filters and preserves canonical order for specific selected topics", () => {
      const selected = normalizeReadingTopics(
        ReadingSchool.EASTERN,
        "love,nguHanh,thienVan"
      );
      // In canonical order: nguHanh -> thienVan -> love
      expect(selected).toEqual(["nguHanh", "thienVan", "love"]);
    });

    it("deduplicates duplicate topic keys", () => {
      const selected = normalizeReadingTopics(
        ReadingSchool.WESTERN,
        "love,love,heartLine,heartLine"
      );
      expect(selected).toEqual(["heartLine", "love"]);
    });

    it("throws error when selecting topic not belonging to the school", () => {
      expect(() => {
        // nguHanh is Eastern, not Western
        normalizeReadingTopics(ReadingSchool.WESTERN, "nguHanh,love");
      }).toThrow(/Mục bói không hợp lệ/);
    });
  });

  describe("createReadingRequestSchema Validation", () => {
    it('validates valid reading request with string aiConsent="true"', async () => {
      const valid = {
        school: ReadingSchool.WESTERN,
        hand: HandSide.LEFT,
        aiConsent: "true",
        topics: "heartLine,love",
      };
      const result = await createReadingRequestSchema.validate(valid);
      expect(result.school).toBe(ReadingSchool.WESTERN);
      expect(result.hand).toBe(HandOrientation.LEFT);
    });

    it("validates request with omitted topics (bói toàn bộ)", async () => {
      const valid = {
        school: ReadingSchool.EASTERN,
        hand: HandSide.RIGHT,
        aiConsent: true,
      };
      const result = await createReadingRequestSchema.validate(valid);
      expect(result.school).toBe(ReadingSchool.EASTERN);
      expect(result.topics).toBeUndefined();
    });

    it("rejects when aiConsent is false or missing", async () => {
      const invalid = {
        school: ReadingSchool.VEDIC,
        hand: HandSide.LEFT,
        aiConsent: false,
      };
      await expect(
        createReadingRequestSchema.validate(invalid)
      ).rejects.toThrow(/đồng ý gửi ảnh/i);
    });

    it("rejects invalid school", async () => {
      const invalid = {
        school: "INVALID_SCHOOL",
        hand: HandSide.LEFT,
        aiConsent: true,
      };
      await expect(
        createReadingRequestSchema.validate(invalid)
      ).rejects.toThrow();
    });

    it("rejects invalid hand", async () => {
      const invalid = {
        school: ReadingSchool.WESTERN,
        hand: "MIDDLE",
        aiConsent: true,
      };
      await expect(
        createReadingRequestSchema.validate(invalid)
      ).rejects.toThrow();
    });

    it("rejects invalid topics not belonging to school", async () => {
      const invalid = {
        school: ReadingSchool.WESTERN,
        hand: HandSide.LEFT,
        aiConsent: true,
        topics: "nguHanh,unknownTopic",
      };
      await expect(
        createReadingRequestSchema.validate(invalid)
      ).rejects.toThrow(/Mục bói không hợp lệ/);
    });
  });
});
