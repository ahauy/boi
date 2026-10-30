import httpService from "@/services/httpService";
import { READINGS_URL } from "@/consts/apiUrl";
import type { ReadingListResponseDto } from "@palmsight/shared";

export class ReadingsHistoryService {
  async getReadings(
    cursor?: string | null,
    limit = 20
  ): Promise<ReadingListResponseDto> {
    const params: Record<string, any> = { limit };
    if (cursor) {
      params.cursor = cursor;
    }
    const response = await httpService.get(READINGS_URL, { params });
    return response.data as ReadingListResponseDto;
  }
}

export const readingsHistoryService = new ReadingsHistoryService();
export default readingsHistoryService;
