import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import loginService from "../services/loginService";
import type { LoginRequestDto, AuthResponseDto } from "@palmsight/shared";

export const useLoginMutation = (
  options?: UseMutationOptions<AuthResponseDto, any, LoginRequestDto>
) => {
  return useMutation({
    mutationFn: (data: LoginRequestDto) => loginService.postLogin(data),
    ...options,
  });
};

export default useLoginMutation;
