import authService from "@/services/authService";
import type { ResetPasswordRequestDto } from "@palmsight/shared";

export const resetPasswordService = {
  postResetPassword: async (data: ResetPasswordRequestDto): Promise<void> => {
    return authService.postResetPassword(data);
  },
};

export default resetPasswordService;
