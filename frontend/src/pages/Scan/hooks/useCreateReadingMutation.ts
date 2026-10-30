import { useMutation, useQueryClient } from "@tanstack/react-query";
import scanService, { CreateReadingParams } from "../services";
import type { CreateReadingResponseDto } from "@palmsight/shared";

export const useCreateReadingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<CreateReadingResponseDto, any, CreateReadingParams>({
    mutationFn: (params: CreateReadingParams) => scanService.createReading(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readings"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
};

export default useCreateReadingMutation;
