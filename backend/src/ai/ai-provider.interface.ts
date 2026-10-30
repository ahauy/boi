import { ReadingSchool, HandOrientation, PalmResult } from "@palmsight/shared";

export interface AiReadingOptions {
  school: ReadingSchool;
  topics: string[];
  hand: HandOrientation;
}

export interface AiProvider {
  readonly name: string;
  readPalm(
    imageBase64: string,
    options: AiReadingOptions,
    modelOverride?: string
  ): Promise<PalmResult>;
}

export { sanitizePalmResult } from "./sanitize-palm-result";
