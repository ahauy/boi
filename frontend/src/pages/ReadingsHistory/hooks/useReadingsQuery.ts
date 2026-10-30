import { useQuery } from "@tanstack/react-query";
import readingsHistoryService from "../services";
import type { ReadingListResponseDto } from "@palmsight/shared";
import { useAuth } from "@/providers/AuthenticationProvider";

export const READINGS_QUERY_KEY = ["readings"];

export const useReadingsQuery = (cursor?: string | null) => {
  const { accessToken } = useAuth();

  return useQuery<ReadingListResponseDto>({
    queryKey: [...READINGS_QUERY_KEY, cursor || "initial"],
    queryFn: () => readingsHistoryService.getReadings(cursor),
    refetchOnMount: true,
    enabled: Boolean(accessToken),
  });
};

export default useReadingsQuery;
