import { Link } from "react-router-dom";
import PageWrapper from "@/components/PageWrapper";
import BaseUrl from "@/consts/baseUrl";
import { useAuth } from "@/providers/AuthenticationProvider";
import useReferralsQuery from "./hooks/useReferralsQuery";
import ReferralShareCard from "./components/ReferralShareCard";
import ReferralTable from "./components/ReferralTable";

export const Referral = () => {
  const { user } = useAuth();
  const { data, isLoading } = useReferralsQuery();

  return (
    <PageWrapper>
      <div className="component:Referral w-full max-w-[960px] mx-auto pt-8 md:pt-12 pb-24 px-4 font-sans text-ink">
        <div className="mb-6">
          <Link
            to={BaseUrl.Account}
            className="text-xs font-mono text-gold-light/80 hover:text-gold-light transition-colors inline-flex items-center gap-1"
          >
            &larr; Quay lại Tài khoản
          </Link>
        </div>

        <div className="pb-4 border-b border-gold/25 mb-8">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-gold mb-1">
            <span>✦</span>
            <span>Kết Duyên Tri Kỷ</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-gold-gradient">Giới thiệu bạn bè</h1>
          <p className="text-sm text-mute mt-1">
            Chia sẻ mã giới thiệu của bạn để nhận thêm credits xem bói miễn phí.
          </p>
        </div>

        <ReferralShareCard referralCode={user?.referralCode || ""} />

        <ReferralTable
          items={data?.items || []}
          totalRewarded={data?.totalRewarded ?? 0}
          totalCreditsEarned={data?.totalCreditsEarned ?? 0}
          isLoading={isLoading}
        />
      </div>
    </PageWrapper>
  );
};

export default Referral;
