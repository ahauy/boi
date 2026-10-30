import authService from "@/services/authService";
import type { ResendVerificationRequestDto } from "@palmsight/shared";

export const checkEmailService = {
  resendVerification: async (data: ResendVerificationRequestDto): Promise<void> => {
    return authService.postResendVerification(data);
  },
};

export default checkEmailService;
