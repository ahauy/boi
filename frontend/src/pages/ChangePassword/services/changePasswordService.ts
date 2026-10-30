import httpService from "@/services/httpService";
import { ME_PASSWORD_URL } from "@/consts/apiUrl";
import type { ChangePasswordPayload } from "../types";

export const changePasswordService = {
  changePassword: async (data: ChangePasswordPayload): Promise<void> => {
    await httpService.put(ME_PASSWORD_URL, data);
  },
};

export default changePasswordService;
