import { describe, it, expect } from "vitest";
import { ReadingSchool, HandOrientation } from "@palmsight/shared";
import { sanitizePalmResult } from "../src/ai/sanitize-palm-result";

describe("sanitizePalmResult", () => {
  it("filters out unrequested sections when user only selects life aspects", () => {
    const rawResult: any = {
      isPalm: true,
      summary: "Tổng quan",
      advice: "Lời khuyên",
      disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
      sections: [
        { key: "nguHanh", title: "Ngũ Hành", observation: "...", meaning: "..." },
        { key: "thienVan", title: "Thiên Văn", observation: "...", meaning: "..." },
      ],
      aspects: {},
    };

    const sanitized = sanitizePalmResult(rawResult, {
      school: ReadingSchool.EASTERN,
      hand: HandOrientation.LEFT,
      topics: ["personality", "career"],
    });

    expect(sanitized.sections).toEqual([]);
    expect(sanitized.topics).toEqual(["personality", "career"]);
    expect(sanitized.school).toBe(ReadingSchool.EASTERN);
    expect(sanitized.hand).toBe(HandOrientation.LEFT);
    expect(sanitized.aspects).toHaveProperty("personality");
    expect(sanitized.aspects!.personality.length).toBeGreaterThan(0);
    expect(sanitized.aspects!.career.length).toBeGreaterThan(0);
  });

  it("preserves AI aspects when provided and filters out unrequested aspects", () => {
    const rawResult: any = {
      isPalm: true,
      summary: "Tổng quan",
      advice: "Lời khuyên",
      disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
      sections: [],
      aspects: {
        personality: "Tính cách kiên định",
        love: "Tình cảm tốt đẹp", // not requested
      },
    };

    const sanitized = sanitizePalmResult(rawResult, {
      school: ReadingSchool.WESTERN,
      hand: HandOrientation.RIGHT,
      topics: ["personality"],
    });

    expect(sanitized.aspects!.personality).toBe("Tính cách kiên định");
    expect(sanitized.aspects!.love).toBeUndefined();
  });

  it("keeps only requested school sections when both sections and aspects are selected", () => {
    const rawResult: any = {
      isPalm: true,
      summary: "Tổng quan",
      advice: "Lời khuyên",
      disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
      sections: [
        { key: "heartLine", title: "Đường tình cảm", observation: "A", meaning: "B" },
        { key: "headLine", title: "Đường trí tuệ", observation: "C", meaning: "D" },
        { key: "lifeLine", title: "Đường sinh mệnh", observation: "E", meaning: "F" },
      ],
      aspects: {
        personality: "Hòa nhã",
      },
    };

    const sanitized = sanitizePalmResult(rawResult, {
      school: ReadingSchool.WESTERN,
      hand: HandOrientation.RIGHT,
      topics: ["heartLine", "personality"],
    });

    expect(sanitized.sections!.length).toBe(1);
    expect(sanitized.sections![0].key).toBe("heartLine");
    expect(sanitized.aspects!.personality).toBe("Hòa nhã");
  });

  it("handles isPalm = false without error", () => {
    const rawResult: any = {
      isPalm: false,
      rejectReason: "Không phải bàn tay",
    };

    const sanitized = sanitizePalmResult(rawResult, {
      school: ReadingSchool.WESTERN,
      hand: HandOrientation.RIGHT,
      topics: ["personality"],
    });

    expect(sanitized.isPalm).toBe(false);
    expect(sanitized.rejectReason).toBe("Không phải bàn tay");
  });

  it("ensures default fallback aspects are distinct and not identical across aspects", () => {
    const rawResult: any = {
      isPalm: true,
      summary: "Tổng quan",
      advice: "Lời khuyên",
      disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
      sections: [],
      aspects: {},
    };

    const sanitized = sanitizePalmResult(rawResult, {
      school: ReadingSchool.EASTERN,
      hand: HandOrientation.LEFT,
      topics: ["personality", "love", "career", "finance", "health", "family"],
    });

    const values = Object.values(sanitized.aspects || {});
    expect(values.length).toBe(6);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(6);
  });
});
