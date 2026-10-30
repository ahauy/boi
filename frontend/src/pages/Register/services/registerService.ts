import authService from "@/services/authService";
import type { RegisterRequestDto, RegisterResponseDto } from "@palmsight/shared";

export const registerService = {
  postRegister: async (data: RegisterRequestDto): Promise<RegisterResponseDto> => {
    return authService.postRegister(data);
  },
};

export default registerService;
