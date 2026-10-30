import {
  ReadingSchool,
  HandOrientation,
  ImageQuality,
  ReadingStatus,
} from "../enums";
import { PaginatedResponseDto } from "./common.dto";

export type PalmLineName = "life" | "head" | "heart" | "other";

export interface PalmLineDto {
  name: PalmLineName;
  points: [number, number][];
  lengthRel: number;
  curvature: number;
  branches: number;
}

export interface ReadingSectionResult {
  key: string;
  title: string;
  observation: string;
  meaning: string;
}

export type ReadingAspectsMap = Record<string, string>;

export interface PalmResult {
  isPalm: boolean;
  rejectReason?: string | null;
  school?: ReadingSchool | null;
  hand?: HandOrientation | null;
  imageQuality?: ImageQuality | null;
  topics?: string[] | null;
  sections?: ReadingSectionResult[] | null;
  aspects?: ReadingAspectsMap | null;
  summary?: string | null;
  advice?: string | null;
  disclaimer?: string | null;
}

export interface CreateReadingRequestDto {
  school: ReadingSchool;
  topics?: string;
  hand: HandOrientation;
  aiConsent: boolean | string;
  palmLines?: string | PalmLineDto[];
}

export interface ReadingDto {
  id: string;
  status: ReadingStatus;
  school: ReadingSchool;
  topics: string[];
  hand: HandOrientation;
  result: PalmResult | null;
  rejectReason: string | null;
  imageUrl?: string | null;
  annotatedImageUrl?: string | null;
  palmLines?: PalmLineDto[] | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ReadingListItemDto {
  id: string;
  status: ReadingStatus;
  school: ReadingSchool;
  topics: string[];
  hand: HandOrientation;
  summary: string | null;
  imageUrl?: string | null;
  annotatedImageUrl?: string | null;
  createdAt: string;
}

export interface CreateReadingResponseDto {
  reading: ReadingDto;
  creditBalance: number;
}

export type ReadingListResponseDto = PaginatedResponseDto<ReadingListItemDto>;

export interface ReadingSectionPreviewDto {
  key: string;
  title: string;
  observation: string | null;
  meaning: string | null;
  isLocked: boolean;
}

export interface ReadingAspectPreviewDto {
  title: string;
  content: string | null;
  isLocked: boolean;
}

export interface ReadingAdvicePreviewDto {
  content: string | null;
  isLocked: boolean;
}

export interface GuestReadingPreviewDto {
  id: string;
  school: ReadingSchool;
  hand: HandOrientation;
  topics: string[];
  status: ReadingStatus;
  summary: string | null;
  sections: ReadingSectionPreviewDto[];
  aspects: Record<string, ReadingAspectPreviewDto>;
  advice: ReadingAdvicePreviewDto | null;
  disclaimer: string;
  imageUrl?: string | null;
  annotatedImageUrl?: string | null;
  palmLines?: PalmLineDto[] | null;
  previewExpiresAt: string;
  createdAt: string;
  claimToken?: string;
  rejectReason?: string | null;
}

export interface CreateGuestReadingResponseDto {
  reading: GuestReadingPreviewDto;
  claimToken: string;
}
