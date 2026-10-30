import { useMutation } from "@tanstack/react-query";
import type { ResetPasswordRequestDto } from "@palmsight/shared";
import resetPasswordService from "../services";

export const useResetPasswordMutation = () => {
  return useMutation({
    mutationFn: (data: ResetPasswordRequestDto) =>
      resetPasswordService.postResetPassword(data),
  });
};

export default useResetPasswordMutation;
