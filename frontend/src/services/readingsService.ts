import httpService from "./httpService";
import { READINGS_URL, READINGS_GUEST_URL } from "@/consts/apiUrl";
import type {
  CreateGuestReadingResponseDto,
  GuestReadingPreviewDto,
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

export class ReadingsService {
  async createGuestReading(
    formData: FormData,
    idempotencyKey: string
  ): Promise<CreateGuestReadingResponseDto> {
    const response = await httpService.axios.post<CreateGuestReadingResponseDto>(
      READINGS_GUEST_URL,
      formData,
      {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        withCredentials: true,
        timeout: 60000,
      }
    );
    return response.data;
  }

  async getGuestReadingPreview(token: string): Promise<GuestReadingPreviewDto> {
    const response = await httpService.axios.get<GuestReadingPreviewDto>(
      `${READINGS_GUEST_URL}/${token}`,
      {
        withCredentials: true,
      }
    );
    return response.data;
  }

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

    const response = await httpService.axios.post<CreateReadingResponseDto>(
      READINGS_URL,
      formData,
      {
        headers: {
          "Idempotency-Key": params.idempotencyKey,
        },
        withCredentials: true,
        timeout: 60000,
      }
    );
    return response.data;
  }

  async getReadingById(readingId: string): Promise<ReadingDto> {
    const response = await httpService.axios.get<ReadingDto>(
      `${READINGS_URL}/${readingId}`,
      {
        withCredentials: true,
      }
    );
    return response.data;
  }
}

export const readingsService = new ReadingsService();
export default readingsService;
