import { Link } from "react-router-dom";
import PageWrapper from "@/components/PageWrapper";
import BaseUrl from "@/consts/baseUrl";
import { useAuth } from "@/providers/AuthenticationProvider";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import useTransactionsQuery from "./hooks/useTransactionsQuery";
import TransactionList from "./components/TransactionList";

export const Wallet = () => {
  const { user } = useAuth();
  const { data, isLoading } = useTransactionsQuery();

  const transactions = data?.items || [];

  return (
    <PageWrapper>
      <div className="component:Wallet w-full max-w-[960px] mx-auto pt-8 md:pt-12 pb-24 px-4 font-sans text-ink">
        <div className="mb-6">
          <Link
            to={BaseUrl.Account}
            className="text-xs font-mono text-gold-light/80 hover:text-gold-light transition-colors inline-flex items-center gap-1"
          >
            &larr; Quay lại Tài khoản
          </Link>
        </div>

        <div className="pb-4 border-b border-gold/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-gold mb-1">
              <span>✦</span>
              <span>Kho Linh Thạch</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-gold-gradient">Ví credits</h1>
            <p className="text-sm text-mute mt-1">
              Quản lý số dư và theo dõi lịch sử nạp/dùng credit.
            </p>
          </div>
          <Link
            to={BaseUrl.Referral}
            className="btn-primary h-10 px-5 text-sm inline-flex items-center justify-center select-none self-start sm:self-auto"
          >
            Mời bạn bè nhận thêm credits &rarr;
          </Link>
        </div>

        <div className="mt-8 p-6 sm:p-8 mystic-card rounded-2xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <TarotCorners />
          <div className="relative z-10">
            <span className="text-xs font-mono text-gold-dim uppercase font-bold tracking-wider">
              Số dư hiện tại
            </span>
            <div
              data-testid="wallet-balance-large"
              className="text-4xl sm:text-5xl font-display font-bold text-gold-gradient mt-2 tracking-tight"
            >
              {user?.creditBalance ?? 0} credits
            </div>
            <p className="text-xs text-mute mt-2">
              Credits không hết hạn. Mỗi lần xem bói tiêu thụ 1 credit.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto relative z-10">
            {user?.referral?.canEnterCode && (
              <Link
                to={BaseUrl.ReferralEnter}
                className="btn-secondary h-10 px-4 text-xs inline-flex items-center justify-center text-center"
              >
                Nhập mã giới thiệu (+1)
              </Link>
            )}
            <Link
              to={BaseUrl.Homepage}
              className="btn-primary h-10 px-5 text-xs inline-flex items-center justify-center text-center"
            >
              Xem bói ngay (−1)
            </Link>
          </div>
        </div>

        <div className="mt-12">
          <div className="pb-3 border-b border-gold/25 mb-4 flex items-center gap-2">
            <span className="text-gold text-sm">✦</span>
            <h2 className="text-xl font-display font-bold text-gold-light">
              Lịch sử biến động credits
            </h2>
          </div>

          <TransactionList
            transactions={transactions}
            isLoading={isLoading}
          />
        </div>
      </div>
    </PageWrapper>
  );
};

export default Wallet;
