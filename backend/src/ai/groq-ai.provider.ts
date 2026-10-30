import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PalmResult, palmResultSchema } from "@palmsight/shared";
import {
  AiProvider,
  AiReadingOptions,
  sanitizePalmResult,
} from "./ai-provider.interface";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";

@Injectable()
export class GroqAiProvider implements AiProvider {
  readonly name = "groq";
  private readonly logger = new Logger(GroqAiProvider.name);

  constructor(private readonly config: ConfigService) {}

  async readPalm(
    imageBase64: string,
    options: AiReadingOptions,
    modelOverride?: string
  ): Promise<PalmResult> {
    const apiKey = this.config.get<string>("GROQ_API_KEY");
    const baseUrl =
      this.config.get<string>("AI_BASE_URL") ||
      "https://api.groq.com/openai/v1";
    const configuredModel =
      (this.config.get<string>("AI_PROVIDER") || "gemini").toLowerCase() ===
      "groq"
        ? this.config.get<string>("AI_MODEL") || "qwen/qwen3.8-27b"
        : this.config.get<string>("AI_FALLBACK_MODEL") || "qwen/qwen3.8-27b";
    const model = modelOverride || configuredModel;
    const timeoutMs = Number(this.config.get<string>("AI_TIMEOUT_MS") || 25000);
    const rawMaxTokens = Number(
      this.config.get<string>("AI_MAX_TOKENS") || 4096
    );
    const maxTokens = model.includes("qwen")
      ? Math.min(rawMaxTokens, 1000)
      : rawMaxTokens;
    const temperature = Number(
      this.config.get<string>("AI_TEMPERATURE") || 0.7
    );

    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const systemPrompt = buildSystemPrompt(options.school);
    const userPrompt = buildUserPrompt(options);

    let didTimeout = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                {
                  type: "image_url",
                  image_url: { url: imageBase64 },
                },
              ],
            },
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          parsedMessage = errorJson?.error?.message
            ? `${errorJson.error.message} (${errorText})`
            : errorText;
        } catch {
          parsedMessage = errorText;
        }
        throw new Error(`Groq API error HTTP ${response.status}: ${parsedMessage}`);
      }

      const data = (await response.json()) as any;
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error("Groq API returned empty message content");
      }

      let parsed: any;
      try {
        parsed = JSON.parse(rawContent);
      } catch (parseErr: any) {
        throw new Error(
          `Groq JSON parse failed: ${parseErr.message}. Raw: ${rawContent.slice(0, 500)}`
        );
      }

      const sanitized = sanitizePalmResult(parsed, options);

      const validated = (await palmResultSchema.validate(sanitized, {
        abortEarly: false,
        stripUnknown: true,
      })) as PalmResult;

      return validated;
    } catch (err: any) {
      const isAbort =
        didTimeout ||
        err.name === "AbortError" ||
        controller.signal.aborted;
      let errorMsg: string;
      if (isAbort) {
        errorMsg = `Groq request timed out after ${timeoutMs}ms or connection was aborted`;
      } else if (err.name === "ValidationError" || Array.isArray(err.errors)) {
        const validationList =
          err.inner && err.inner.length > 0
            ? err.inner
                .map((e: any) => `${e.path || "root"}: ${e.message}`)
                .join(", ")
            : err.errors?.join(", ") || err.message;
        errorMsg = `Schema validation failed: [${validationList}]`;
      } else if (err.cause?.message) {
        errorMsg = `${err.message} (cause: ${err.cause.message})`;
      } else {
        errorMsg = err.message;
      }
      this.logger.warn(`Groq reading failed: ${errorMsg}`);
      if (isAbort || err.name === "ValidationError") {
        throw new Error(errorMsg);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
