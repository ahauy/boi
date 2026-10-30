import { ReadingSchool, HandOrientation, ReadingDto } from "@palmsight/shared";

export interface ScanState {
  school: ReadingSchool;
  isAllTopics: boolean;
  selectedSections: string[];
  selectedAspects: string[];
  hand: HandOrientation;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  aiConsent: boolean;
}

export type ScanStatus =
  | "IDLE"
  | "ANALYZING"
  | "REJECTED"
  | "AI_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "INSUFFICIENT_CREDITS"
  | "LIMIT_REACHED"
  | "RATE_LIMITED";

export interface ScanResultError {
  status: ScanStatus;
  message?: string;
  rejectReason?: string | null;
  readingId?: string | null;
}

export interface ReadingCreatedResult {
  reading: ReadingDto;
  creditBalance: number;
}
