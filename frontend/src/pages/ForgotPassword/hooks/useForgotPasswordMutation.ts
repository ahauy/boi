import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import forgotPasswordService from "../services/forgotPasswordService";
import type { ForgotPasswordRequestDto } from "@palmsight/shared";

export const useForgotPasswordMutation = (
  options?: UseMutationOptions<void, any, ForgotPasswordRequestDto>
) => {
  return useMutation({
    mutationFn: (data: ForgotPasswordRequestDto) =>
      forgotPasswordService.postForgotPassword(data),
    ...options,
  });
};

export default useForgotPasswordMutation;
