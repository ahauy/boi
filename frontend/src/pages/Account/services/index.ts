import httpService from "@/services/httpService";
import { ME_URL, ME_REFERRAL_URL } from "@/consts/apiUrl";
import type { MeResponseDto, EnterReferralResponseDto } from "@palmsight/shared";

export class AccountService {
  async getMe(): Promise<MeResponseDto> {
    const response = await httpService.get(ME_URL);
    return response.data as MeResponseDto;
  }

  async enterReferral(code: string): Promise<EnterReferralResponseDto> {
    const response = await httpService.post(ME_REFERRAL_URL, {
      code: code.trim().toUpperCase(),
    });
    return response.data as EnterReferralResponseDto;
  }
}

export const accountService = new AccountService();
export default accountService;
