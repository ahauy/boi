import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import registerService from "../services/registerService";
import type { RegisterRequestDto, RegisterResponseDto } from "@palmsight/shared";

export const useRegisterMutation = (
  options?: UseMutationOptions<RegisterResponseDto, any, RegisterRequestDto>
) => {
  return useMutation({
    mutationFn: (data: RegisterRequestDto) => registerService.postRegister(data),
    ...options,
  });
};

export default useRegisterMutation;
