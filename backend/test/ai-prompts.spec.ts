import { describe, it, expect } from "vitest";
import { READING_SCHOOLS, ReadingSchool, HandOrientation } from "@palmsight/shared";
import {
  SCHOOL_PROMPTS,
  buildSystemPrompt,
  buildUserPrompt,
  COMMON_SYSTEM_PROMPT,
} from "../src/ai/prompts";

describe("US-AI-001: AI Prompts Quality & Completeness", () => {
  it("ensures every school in READING_SCHOOLS has a defined prompt", () => {
    for (const schoolKey of Object.values(ReadingSchool)) {
      expect(
        SCHOOL_PROMPTS[schoolKey],
        `Thiếu prompt cho trường phái ${schoolKey}`
      ).toBeDefined();
      expect(
        typeof SCHOOL_PROMPTS[schoolKey] === "string" &&
          SCHOOL_PROMPTS[schoolKey].length > 0
      ).toBe(true);
    }
  });

  it("ensures every section key of each school appears in that school prompt", () => {
    for (const schoolKey of Object.values(ReadingSchool)) {
      const config = READING_SCHOOLS[schoolKey];
      const prompt = SCHOOL_PROMPTS[schoolKey];

      for (const section of config.sections) {
        expect(
          prompt.includes(section.key),
          `Key "${section.key}" của trường phái ${schoolKey} không xuất hiện trong prompt`
        ).toBe(true);
      }
    }
  });

  it("ensures buildSystemPrompt attaches the common system rules and disclaimer", () => {
    const systemPrompt = buildSystemPrompt(ReadingSchool.WESTERN);
    expect(systemPrompt).toContain(COMMON_SYSTEM_PROMPT);
    expect(systemPrompt).toContain(
      "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn."
    );
    expect(systemPrompt).toContain("isPalm=false");
  });

  it("buildUserPrompt formats instructions correctly when only aspects are selected", () => {
    const prompt = buildUserPrompt({
      school: ReadingSchool.EASTERN,
      hand: HandOrientation.LEFT,
      topics: ["personality", "career"],
    });

    expect(prompt).toContain(
      'Mục đường chỉ & dấu hiệu (sections): Người dùng KHÔNG chọn mục nào trong nhóm này -> BẮT BUỘC trả về mảng rỗng: "sections": []'
    );
    expect(prompt).toContain(
      'Khía cạnh cuộc sống (aspects): BẮT BUỘC phân tích và điền đầy đủ các key sau trong object "aspects"'
    );
    expect(prompt).toContain('"sections": [],');
    expect(prompt).toContain('"personality": string');
    expect(prompt).toContain('"career": string');
  });

  it("buildUserPrompt formats instructions correctly when only sections are selected", () => {
    const prompt = buildUserPrompt({
      school: ReadingSchool.WESTERN,
      hand: HandOrientation.RIGHT,
      topics: ["heartLine", "headLine"],
    });

    expect(prompt).toContain(
      "Mục đường chỉ & dấu hiệu (sections): BẮT BUỘC CHỈ phân tích đúng các mục sau: heartLine (Đường tình cảm), headLine (Đường trí tuệ)"
    );
    expect(prompt).toContain(
      'Khía cạnh cuộc sống (aspects): Người dùng KHÔNG chọn mục nào trong nhóm này -> BẮT BUỘC trả về object rỗng: "aspects": {}'
    );
    expect(prompt).toContain('"aspects": {},');
  });
});

