import { useQuery } from "@tanstack/react-query";
import accountService from "../services";
import type { MeResponseDto } from "@palmsight/shared";
import { useAuth } from "@/providers/AuthenticationProvider";
import { useEffect } from "react";

export const ME_QUERY_KEY = ["me"];

export const useMeQuery = () => {
  const { user, updateUser } = useAuth();

  const query = useQuery<MeResponseDto>({
    // Keyed by user so a different account in the same tab never sees the previous one's cached profile
    queryKey: [...ME_QUERY_KEY, user?.id],
    queryFn: () => accountService.getMe(),
    enabled: Boolean(user?.id),
    // Always re-read on open: hasPassword / canEnterCode change outside this page (e.g. password set via email)
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (query.data) {
      updateUser(query.data);
    }
  }, [query.data, updateUser]);

  return query;
};

export default useMeQuery;
