import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import changePasswordService from "../services/changePasswordService";
import type { ChangePasswordPayload } from "../types";

export const useChangePasswordMutation = (
  options?: UseMutationOptions<void, any, ChangePasswordPayload>
) => {
  return useMutation({
    mutationFn: (data: ChangePasswordPayload) =>
      changePasswordService.changePassword(data),
    ...options,
  });
};

export default useChangePasswordMutation;
