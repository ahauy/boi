import authService from "@/services/authService";
import type {
  VerifyEmailRequestDto,
  AuthResponseDto,
  ResendVerificationRequestDto,
} from "@palmsight/shared";

export const verifyEmailService = {
  postVerifyEmail: async (
    data: VerifyEmailRequestDto
  ): Promise<AuthResponseDto> => {
    return authService.postVerifyEmail(data);
  },
  postResendVerification: async (
    data: ResendVerificationRequestDto
  ): Promise<void> => {
    return authService.postResendVerification(data);
  },
};

export default verifyEmailService;
