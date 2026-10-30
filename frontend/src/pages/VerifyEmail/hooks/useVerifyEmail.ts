import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import verifyEmailService from "../services/verifyEmailService";
import type {
  VerifyEmailRequestDto,
  AuthResponseDto,
  ResendVerificationRequestDto,
} from "@palmsight/shared";

export const useVerifyEmail = (
  options?: UseMutationOptions<AuthResponseDto, any, VerifyEmailRequestDto>
) => {
  return useMutation({
    mutationFn: (data: VerifyEmailRequestDto) =>
      verifyEmailService.postVerifyEmail(data),
    ...options,
  });
};

export const useResendVerificationMutation = (
  options?: UseMutationOptions<void, any, ResendVerificationRequestDto>
) => {
  return useMutation({
    mutationFn: (data: ResendVerificationRequestDto) =>
      verifyEmailService.postResendVerification(data),
    ...options,
  });
};

export default useVerifyEmail;
