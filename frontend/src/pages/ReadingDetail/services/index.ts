import httpService from "@/services/httpService";
import { READINGS_URL } from "@/consts/apiUrl";
import type { ReadingDto } from "@palmsight/shared";

export class ReadingDetailService {
  async getReading(id: string): Promise<ReadingDto> {
    const response = await httpService.get(`${READINGS_URL}/${id}`);
    return response.data as ReadingDto;
  }

  async deleteReading(id: string): Promise<void> {
    await httpService.delete(`${READINGS_URL}/${id}`);
  }
}

export const readingDetailService = new ReadingDetailService();
export default readingDetailService;
