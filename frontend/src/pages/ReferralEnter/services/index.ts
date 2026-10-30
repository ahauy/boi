import httpService from "@/services/httpService";
import { ME_REFERRAL_URL } from "@/consts/apiUrl";
import type {
  EnterReferralRequestDto,
  EnterReferralResponseDto,
} from "@palmsight/shared";

export class ReferralEnterService {
  async enterReferral(
    data: EnterReferralRequestDto
  ): Promise<EnterReferralResponseDto> {
    const response = await httpService.post(
      ME_REFERRAL_URL,
      {
        code: data.code.trim().toUpperCase(),
      }
    );
    return response.data as EnterReferralResponseDto;
  }
}

export const referralEnterService = new ReferralEnterService();
export default referralEnterService;
