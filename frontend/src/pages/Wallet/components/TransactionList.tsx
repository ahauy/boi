import { CreditTransactionDto, CreditTransactionType } from "../types";

interface TransactionListProps {
  transactions: CreditTransactionDto[];
  isLoading: boolean;
}

const getTransactionTypeName = (tx: CreditTransactionDto): string => {
  switch (tx.type) {
    case CreditTransactionType.SIGNUP_BONUS:
      return "Quà đăng ký";
    case CreditTransactionType.REFERRAL_BONUS:
      return "Thưởng giới thiệu";
    case CreditTransactionType.REFEREE_BONUS:
      return "Thưởng nhập mã";
    case CreditTransactionType.READING_SPEND:
      return "Xem bói";
    case CreditTransactionType.READING_REFUND:
      return "Hoàn credit";
    case CreditTransactionType.ADMIN_ADJUST:
      return tx.note ? `Điều chỉnh (${tx.note})` : "Điều chỉnh hệ thống";
    default:
      return tx.type;
  }
};

const formatDate = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
};

export const TransactionList = ({
  transactions,
  isLoading,
}: TransactionListProps) => {
  if (isLoading && transactions.length === 0) {
    return (
      <div className="py-10 mystic-card rounded-xl text-center text-sm text-mute font-mono">
        ✦ Đang tải lịch sử giao dịch...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div
        data-testid="empty-transactions"
        className="py-12 mystic-card rounded-xl text-center text-sm text-mute font-mono border border-dashed border-gold/25"
      >
        Chưa có giao dịch credits nào.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto mystic-card rounded-2xl p-4 sm:p-6 font-mono text-ink">
      <div className="min-w-[560px] flex flex-col">
        <div className="pb-3 border-b border-gold/25 text-xs uppercase tracking-wider text-gold-dim grid grid-cols-[160px_1fr_100px_100px]">
          <div>Ngày</div>
          <div>Loại</div>
          <div>Credits</div>
          <div>Số dư</div>
        </div>

        {transactions.map((tx) => {
          const isPositive = tx.amount > 0;
          return (
            <div
              key={tx.id}
              data-testid="transaction-row"
              className="py-3.5 border-b border-gold/10 last:border-b-0 text-sm grid grid-cols-[160px_1fr_100px_100px] items-center hover:bg-surface-soft/50 transition-colors"
            >
              <div className="text-mute text-xs">{formatDate(tx.createdAt)}</div>
              <div className="text-ink font-sans font-medium">
                {getTransactionTypeName(tx)}
              </div>
              <div
                className={`font-bold ${
                  isPositive ? "text-terminal-success" : "text-terminal-danger"
                }`}
              >
                {isPositive ? `+${tx.amount}` : `${tx.amount}`}
              </div>
              <div className="font-bold text-gold-light">{tx.balanceAfter}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TransactionList;
