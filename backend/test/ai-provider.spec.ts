import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { ReadingSchool, HandOrientation } from "@palmsight/shared";
import { GroqAiProvider } from "../src/ai/groq-ai.provider";
import { GeminiAiProvider } from "../src/ai/gemini-ai.provider";
import { AiService } from "../src/ai/ai.service";

describe("US-AI-001: AI Vision Provider & Fallback Pipeline", () => {
  let configService: ConfigService;
  let groqProvider: GroqAiProvider;
  let geminiProvider: GeminiAiProvider;
  let aiService: AiService;

  const mockValidPalmResult = {
    isPalm: true,
    rejectReason: null,
    school: ReadingSchool.EASTERN,
    hand: HandOrientation.LEFT,
    imageQuality: "GOOD",
    topics: ["nguHanh", "thienVan", "love"],
    sections: [
      {
        key: "nguHanh",
        title: "Dáng tay ngũ hành",
        observation: "Lòng bàn tay vuông vức, ngón tay đầy đặn",
        meaning: "Mệnh Thổ: thực tế, kiên định",
      },
      {
        key: "thienVan",
        title: "Thiên văn",
        observation: "Đường thiên văn sâu và dài tới gò Mộc Tinh",
        meaning: "Tình cảm chân thành, sâu sắc",
      },
    ],
    aspects: {
      love: "Tình cảm thuận lợi, gắn kết",
    },
    summary: "Bàn tay phú quý, cuộc sống ổn định và bền vững.",
    advice: "Duy trì sự kiên nhẫn trong các quyết định lớn.",
    disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
  };

  beforeEach(() => {
    configService = new ConfigService({
      AI_PROVIDER: "gemini",
      AI_FALLBACK_PROVIDER: "groq",
      AI_MODEL: "gemini-3.5-flash",
      AI_FALLBACK_MODEL: "qwen/qwen3.8-27b",
      GROQ_API_KEY: "test-groq-key",
      GEMINI_API_KEY: "test-gemini-key",
      AI_TIMEOUT_MS: "2000",
    });

    groqProvider = new GroqAiProvider(configService);
    geminiProvider = new GeminiAiProvider(configService);
    aiService = new AiService(configService, groqProvider, geminiProvider);

    vi.restoreAllMocks();
  });

  it("GroqAiProvider successfully parses and validates valid PalmResult", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockValidPalmResult),
              },
            },
          ],
        }),
      })
    );

    const result = await groqProvider.readPalm("data:image/jpeg;base64,xxxx", {
      school: ReadingSchool.EASTERN,
      topics: ["nguHanh", "thienVan", "love"],
      hand: HandOrientation.LEFT,
    });

    expect(result.isPalm).toBe(true);
    expect(result.school).toBe(ReadingSchool.EASTERN);
    expect(result.hand).toBe(HandOrientation.LEFT);
    expect(result.sections?.length).toBe(2);
    expect(result.disclaimer).toContain("Kết quả mang tính giải trí");
  });

  it("GeminiAiProvider successfully parses and validates valid PalmResult", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(mockValidPalmResult) }],
              },
            },
          ],
        }),
      })
    );

    const result = await geminiProvider.readPalm(
      "data:image/jpeg;base64,xxxx",
      {
        school: ReadingSchool.EASTERN,
        topics: ["nguHanh", "thienVan", "love"],
        hand: HandOrientation.LEFT,
      }
    );

    expect(result.isPalm).toBe(true);
    expect(result.school).toBe(ReadingSchool.EASTERN);
    expect(result.hand).toBe(HandOrientation.LEFT);
  });

  it("AiService calls Gemini as primary provider by default", async () => {
    vi.spyOn(geminiProvider, "readPalm").mockResolvedValue(
      mockValidPalmResult as any
    );
    vi.spyOn(groqProvider, "readPalm");

    const response = await aiService.readPalm("data:image/jpeg;base64,xxxx", {
      school: ReadingSchool.EASTERN,
      topics: ["nguHanh", "thienVan", "love"],
      hand: HandOrientation.LEFT,
    });

    expect(geminiProvider.readPalm).toHaveBeenCalledTimes(1);
    expect(groqProvider.readPalm).not.toHaveBeenCalled();
    expect(response.provider).toBe("gemini");
    expect(response.model).toBe("gemini-3.5-flash");
    expect(response.result.isPalm).toBe(true);
  });

  it("AiService falls back to Groq when Gemini fails", async () => {
    vi.spyOn(geminiProvider, "readPalm").mockRejectedValue(
      new Error("Gemini API error HTTP 429: Rate limit exceeded")
    );
    vi.spyOn(groqProvider, "readPalm").mockResolvedValue(
      mockValidPalmResult as any
    );

    const response = await aiService.readPalm("data:image/jpeg;base64,xxxx", {
      school: ReadingSchool.EASTERN,
      topics: ["nguHanh", "thienVan", "love"],
      hand: HandOrientation.LEFT,
    });

    expect(geminiProvider.readPalm).toHaveBeenCalledTimes(1);
    expect(groqProvider.readPalm).toHaveBeenCalledTimes(1);
    expect(response.provider).toBe("groq");
    expect(response.model).toBe("qwen/qwen3.8-27b");
    expect(response.result.isPalm).toBe(true);
  });

  it("AiService falls back to Gemini when Groq is configured as primary and fails", async () => {
    const groqPrimaryConfig = new ConfigService({
      AI_PROVIDER: "groq",
      AI_FALLBACK_PROVIDER: "gemini",
      AI_MODEL: "qwen/qwen3.8-27b",
      AI_FALLBACK_MODEL: "gemini-3.5-flash",
      GROQ_API_KEY: "test-groq-key",
      GEMINI_API_KEY: "test-gemini-key",
      AI_TIMEOUT_MS: "2000",
    });
    const localGroq = new GroqAiProvider(groqPrimaryConfig);
    const localGemini = new GeminiAiProvider(groqPrimaryConfig);
    const localService = new AiService(groqPrimaryConfig, localGroq, localGemini);

    vi.spyOn(localGroq, "readPalm").mockRejectedValue(
      new Error("Groq API error HTTP 429: Rate limit exceeded")
    );
    vi.spyOn(localGemini, "readPalm").mockResolvedValue(
      mockValidPalmResult as any
    );

    const response = await localService.readPalm("data:image/jpeg;base64,xxxx", {
      school: ReadingSchool.EASTERN,
      topics: ["nguHanh", "thienVan", "love"],
      hand: HandOrientation.LEFT,
    });

    expect(localGroq.readPalm).toHaveBeenCalledTimes(1);
    expect(localGemini.readPalm).toHaveBeenCalledTimes(1);
    expect(response.provider).toBe("gemini");
    expect(response.result.isPalm).toBe(true);
  });

  it("AiService correctly propagates error if both primary and fallback fail", async () => {
    vi.spyOn(geminiProvider, "readPalm").mockRejectedValue(
      new Error("Gemini unavailable")
    );
    vi.spyOn(groqProvider, "readPalm").mockRejectedValue(
      new Error("Groq unavailable")
    );

    await expect(
      aiService.readPalm("data:image/jpeg;base64,xxxx", {
        school: ReadingSchool.EASTERN,
        topics: ["nguHanh", "thienVan", "love"],
        hand: HandOrientation.LEFT,
      })
    ).rejects.toThrow("Groq unavailable");
  });

  it("GeminiAiProvider formats timeout error descriptively", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const error = new Error("This operation was aborted");
        error.name = "AbortError";
        return Promise.reject(error);
      })
    );

    await expect(
      geminiProvider.readPalm("data:image/jpeg;base64,xxxx", {
        school: ReadingSchool.EASTERN,
        topics: ["nguHanh", "thienVan", "love"],
        hand: HandOrientation.LEFT,
      })
    ).rejects.toThrow("Gemini request timed out after 2000ms or connection was aborted");
  });

  it("GeminiAiProvider parses error json when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () =>
          JSON.stringify({
            error: {
              code: 429,
              message: "Resource has been exhausted",
              status: "RESOURCE_EXHAUSTED",
            },
          }),
      })
    );

    await expect(
      geminiProvider.readPalm("data:image/jpeg;base64,xxxx", {
        school: ReadingSchool.EASTERN,
        topics: ["nguHanh", "thienVan", "love"],
        hand: HandOrientation.LEFT,
      })
    ).rejects.toThrow("Gemini API error HTTP 429: Resource has been exhausted");
  });

  it("GroqAiProvider caps maxTokens to 1000 for qwen models", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(mockValidPalmResult),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await groqProvider.readPalm("data:image/jpeg;base64,xxxx", {
      school: ReadingSchool.EASTERN,
      topics: ["nguHanh", "thienVan", "love"],
      hand: HandOrientation.LEFT,
    });

    expect(fetchMock).toHaveBeenCalled();
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.max_tokens).toBe(1000);
  });

  it("GroqAiProvider logs detailed validation errors if schema validation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ isPalm: null }),
              },
            },
          ],
        }),
      })
    );

    await expect(
      groqProvider.readPalm("data:image/jpeg;base64,xxxx", {
        school: ReadingSchool.EASTERN,
        topics: ["nguHanh", "thienVan", "love"],
        hand: HandOrientation.LEFT,
      })
    ).rejects.toThrow(/Schema validation failed:/);
  });
});
