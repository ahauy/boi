import httpService from "@/services/httpService";
import { READINGS_URL } from "@/consts/apiUrl";
import type {
  CreateReadingResponseDto,
  ReadingDto,
  ReadingSchool,
  HandOrientation,
  PalmLineDto,
} from "@palmsight/shared";

export interface CreateReadingParams {
  school: ReadingSchool;
  hand: HandOrientation;
  topics?: string[];
  aiConsent: boolean;
  image: File | Blob;
  annotatedImage?: File | Blob | null;
  palmLines?: PalmLineDto[] | null;
  idempotencyKey: string;
}

export class ScanService {
  async createReading(params: CreateReadingParams): Promise<CreateReadingResponseDto> {
    const formData = new FormData();
    formData.append("school", params.school);
    if (params.topics && params.topics.length > 0) {
      formData.append("topics", params.topics.join(","));
    }
    formData.append("hand", params.hand);
    formData.append("aiConsent", String(params.aiConsent));
    formData.append("image", params.image);
    if (params.annotatedImage) {
      formData.append("annotatedImage", params.annotatedImage);
    }
    if (params.palmLines && params.palmLines.length > 0) {
      formData.append("palmLines", JSON.stringify(params.palmLines));
    }

    const response = await httpService.post(READINGS_URL, formData, {
      headers: {
        "Idempotency-Key": params.idempotencyKey,
      },
      timeout: 60000,
    });

    return response.data as CreateReadingResponseDto;
  }

  async getReadingById(readingId: string): Promise<ReadingDto> {
    const response = await httpService.get(`${READINGS_URL}/${readingId}`);
    return response.data as ReadingDto;
  }
}

export const scanService = new ScanService();
export default scanService;
