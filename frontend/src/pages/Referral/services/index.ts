import httpService from "@/services/httpService";
import { ME_REFERRALS_URL } from "@/consts/apiUrl";
import type { ReferralListResponseDto } from "@palmsight/shared";

export class ReferralService {
  async getReferrals(
    cursor?: string | null,
    limit = 20
  ): Promise<ReferralListResponseDto> {
    const params: Record<string, any> = { limit };
    if (cursor) {
      params.cursor = cursor;
    }
    const response = await httpService.get(
      ME_REFERRALS_URL,
      { params }
    );
    return response.data as ReferralListResponseDto;
  }
}

export const referralService = new ReferralService();
export default referralService;
