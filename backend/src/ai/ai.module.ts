import { Module } from "@nestjs/common";
import { GroqAiProvider } from "./groq-ai.provider";
import { GeminiAiProvider } from "./gemini-ai.provider";
import { AiService } from "./ai.service";

@Module({
  providers: [GroqAiProvider, GeminiAiProvider, AiService],
  exports: [AiService],
})
export class AiModule {}
