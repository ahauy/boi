import authService from "@/services/authService";
import type { ForgotPasswordRequestDto } from "@palmsight/shared";

export const forgotPasswordService = {
  postForgotPassword: async (data: ForgotPasswordRequestDto): Promise<void> => {
    return authService.postForgotPassword(data);
  },
};

export default forgotPasswordService;
