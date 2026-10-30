import { ReferralListItemDto, ReferralStatus } from "../types";

interface ReferralTableProps {
  items: ReferralListItemDto[];
  totalRewarded: number;
  totalCreditsEarned: number;
  isLoading: boolean;
}

const formatDate = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
};

export const ReferralTable = ({
  items,
  totalRewarded,
  totalCreditsEarned,
  isLoading,
}: ReferralTableProps) => {
  return (
    <div className="w-full mt-12 font-sans text-ink">
      <div className="pb-3 border-b border-gold/25">
        <h3 className="text-xl font-display font-bold text-gold-light">Người đã mời</h3>
        <div
          data-testid="referral-stats"
          className="mt-1 text-xs font-mono text-gold-dim"
        >
          {totalRewarded} lượt được thưởng · +{totalCreditsEarned} credits
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="mt-4 py-10 mystic-card rounded-xl text-center text-sm text-mute font-mono">
          ✦ Đang tải danh sách người đã mời...
        </div>
      ) : items.length === 0 ? (
        <div
          data-testid="empty-referrals"
          className="mt-4 py-10 mystic-card rounded-xl text-center text-sm text-mute border border-dashed border-gold/25"
        >
          Chưa có ai sử dụng mã giới thiệu của bạn. Hãy chia sẻ mã để nhận thêm credits!
        </div>
      ) : (
        <div className="mt-4 w-full overflow-x-auto mystic-card rounded-2xl p-4 sm:p-6">
          <div className="min-w-[500px] flex flex-col">
            <div className="pb-3 border-b border-gold/25 text-xs font-mono uppercase tracking-wider text-gold-dim grid grid-cols-[160px_120px_1fr]">
              <div>Tên</div>
              <div>Ngày</div>
              <div>Kết quả</div>
            </div>

            {items.map((item, index) => {
              const isRewarded = item.status === ReferralStatus.REWARDED;
              return (
                <div
                  key={`${item.displayName}-${item.createdAt}-${index}`}
                  data-testid="referral-row"
                  className="py-3.5 border-b border-gold/10 last:border-b-0 text-sm grid grid-cols-[160px_120px_1fr] items-center hover:bg-surface-soft/50 transition-colors"
                >
                  <div className="text-ink font-medium">
                    {item.displayName || "Người dùng"}
                  </div>
                  <div className="text-mute font-mono text-xs">
                    {formatDate(item.createdAt)}
                  </div>
                  <div>
                    {isRewarded ? (
                      <span className="font-bold font-mono text-terminal-success">
                        +{item.creditsEarned} credits
                      </span>
                    ) : (
                      <span className="text-xs text-mute">
                        Đã ghi nhận · không cộng (hết lượt hôm nay)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralTable;
