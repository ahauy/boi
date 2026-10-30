import { useQuery } from "@tanstack/react-query";
import walletService from "../services";
import type { CreditTransactionListResponseDto } from "@palmsight/shared";
import { useAuth } from "@/providers/AuthenticationProvider";

export const TRANSACTIONS_QUERY_KEY = ["credit-transactions"];

export const useTransactionsQuery = (cursor?: string | null) => {
  const { accessToken } = useAuth();

  return useQuery<CreditTransactionListResponseDto>({
    queryKey: [...TRANSACTIONS_QUERY_KEY, cursor || "initial"],
    queryFn: () => walletService.getTransactions(cursor),
    enabled: Boolean(accessToken),
  });
};

export default useTransactionsQuery;
