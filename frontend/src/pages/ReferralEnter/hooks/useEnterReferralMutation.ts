import { useMutation } from "@tanstack/react-query";
import referralEnterService from "../services";
import type {
  EnterReferralRequestDto,
  EnterReferralResponseDto,
} from "@palmsight/shared";

export const useEnterReferralMutation = () => {
  return useMutation<EnterReferralResponseDto, any, EnterReferralRequestDto>({
    mutationFn: (data: EnterReferralRequestDto) =>
      referralEnterService.enterReferral(data),
  });
};

export default useEnterReferralMutation;
