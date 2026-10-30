import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PalmResult } from "@palmsight/shared";
import {
  AiProvider,
  AiReadingOptions,
  sanitizePalmResult,
} from "./ai-provider.interface";
import { GroqAiProvider } from "./groq-ai.provider";
import { GeminiAiProvider } from "./gemini-ai.provider";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly providers: Record<string, AiProvider>;

  constructor(
    private readonly config: ConfigService,
    private readonly groqProvider: GroqAiProvider,
    private readonly geminiProvider: GeminiAiProvider
  ) {
    this.providers = {
      groq: this.groqProvider,
      gemini: this.geminiProvider,
    };
  }

  async readPalm(
    imageBase64: string,
    options: AiReadingOptions
  ): Promise<{ result: PalmResult; provider: string; model: string }> {
    const primaryName = (
      this.config.get<string>("AI_PROVIDER") || "gemini"
    ).toLowerCase();
    const fallbackName = (
      this.config.get<string>("AI_FALLBACK_PROVIDER") || "groq"
    ).toLowerCase();

    const primaryProvider = this.providers[primaryName] || this.geminiProvider;
    const fallbackProvider =
      this.providers[fallbackName] || this.groqProvider;

    const primaryModel =
      this.config.get<string>("AI_MODEL") ||
      (primaryName === "gemini" ? "gemini-3.5-flash" : "qwen/qwen3.8-27b");

    const fallbackModel =
      this.config.get<string>("AI_FALLBACK_MODEL") ||
      (fallbackName === "groq" ? "qwen/qwen3.8-27b" : "gemini-3.5-flash");

    try {
      this.logger.log(
        `Calling primary AI provider: ${primaryProvider.name} (${primaryModel})`
      );
      const rawResult = await primaryProvider.readPalm(
        imageBase64,
        options,
        primaryModel
      );
      const result = sanitizePalmResult(rawResult, options);
      return { result, provider: primaryProvider.name, model: primaryModel };
    } catch (primaryErr: any) {
      this.logger.warn(
        `Primary AI provider ${primaryProvider.name} failed: ${primaryErr.message}. Attempting fallback to ${fallbackProvider.name}...`
      );

      if (fallbackProvider && fallbackProvider !== primaryProvider) {
        try {
          const rawResult = await fallbackProvider.readPalm(
            imageBase64,
            options,
            fallbackModel
          );
          const result = sanitizePalmResult(rawResult, options);
          return {
            result,
            provider: fallbackProvider.name,
            model: fallbackModel,
          };
        } catch (fallbackErr: any) {
          this.logger.error(
            `Fallback AI provider ${fallbackProvider.name} also failed: ${fallbackErr.message}. Primary (${primaryProvider.name}) error: ${primaryErr.message}`
          );
          throw fallbackErr;
        }
      }

      throw primaryErr;
    }
  }
}
