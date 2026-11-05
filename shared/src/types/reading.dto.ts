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

export type ReadingListResponseDto = PaginatedResponseDto<ReadingListItemDto>;
