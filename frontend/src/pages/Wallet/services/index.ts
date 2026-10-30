import httpService from "@/services/httpService";
import { ME_CREDIT_TRANSACTIONS_URL } from "@/consts/apiUrl";
import type { CreditTransactionListResponseDto } from "@palmsight/shared";

export class WalletService {
  async getTransactions(
    cursor?: string | null,
    limit = 20
  ): Promise<CreditTransactionListResponseDto> {
    const params: Record<string, any> = { limit };
    if (cursor) {
      params.cursor = cursor;
    }
    const response = await httpService.get(
      ME_CREDIT_TRANSACTIONS_URL,
      { params }
    );
    return response.data as CreditTransactionListResponseDto;
  }
}

export const walletService = new WalletService();
export default walletService;
