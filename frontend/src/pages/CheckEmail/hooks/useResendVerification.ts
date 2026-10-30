import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import checkEmailService from "../services/checkEmailService";
import type { ResendVerificationRequestDto } from "@palmsight/shared";

export const useResendVerification = (
  options?: UseMutationOptions<void, any, ResendVerificationRequestDto>
) => {
  return useMutation({
    mutationFn: (data: ResendVerificationRequestDto) =>
      checkEmailService.resendVerification(data),
    ...options,
  });
};

export default useResendVerification;
