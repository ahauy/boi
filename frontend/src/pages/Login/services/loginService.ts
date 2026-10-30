import authService from "@/services/authService";
import type { LoginRequestDto, AuthResponseDto } from "@palmsight/shared";

export const loginService = {
  postLogin: async (data: LoginRequestDto): Promise<AuthResponseDto> => {
    return authService.postLogin(data);
  },
};

export default loginService;
