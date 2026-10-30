import { useQuery } from "@tanstack/react-query";
import referralService from "../services";
import type { ReferralListResponseDto } from "@palmsight/shared";
import { useAuth } from "@/providers/AuthenticationProvider";

export const REFERRALS_QUERY_KEY = ["me-referrals"];

export const useReferralsQuery = (cursor?: string | null) => {
  const { accessToken } = useAuth();

  return useQuery<ReferralListResponseDto>({
    queryKey: [...REFERRALS_QUERY_KEY, cursor || "initial"],
    queryFn: () => referralService.getReferrals(cursor),
    enabled: Boolean(accessToken),
  });
};

export default useReferralsQuery;
