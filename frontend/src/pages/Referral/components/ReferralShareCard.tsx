import { useState } from "react";
import { showSuccess } from "@/helpers/toast";
import { TarotCorners } from "@/components/mystic/MysticDivider";

interface ReferralShareCardProps {
  referralCode: string;
}

export const ReferralShareCard = ({ referralCode }: ReferralShareCardProps) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const domain =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://palmsight.app";
  const shareLink = `${domain}/r/${referralCode}`;
  const sampleMessage = `Nhập mã ${referralCode} trên PalmSight: bạn được thêm 1 credit xem bói miễn phí`;

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    showSuccess("Đã sao chép mã giới thiệu!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    showSuccess("Đã sao chép liên kết giới thiệu!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(sampleMessage);
    setCopiedMessage(true);
    showSuccess("Đã sao chép câu mời mẫu!");
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "PalmSight - Bói chỉ tay AI",
          text: sampleMessage,
          url: shareLink,
        });
        return;
      } catch {
        handleCopyLink();
        return;
      }
    }
    handleCopyLink();
  };

  return (
    <div className="w-full flex flex-col font-sans text-ink">
      <h2 className="text-lg font-display font-bold text-gold-light mb-3">Mã của tôi</h2>

      <div className="max-w-[540px] mystic-card rounded-2xl p-5 flex justify-between items-center relative overflow-hidden">
        <TarotCorners />
        <span
          data-testid="referral-code-display"
          className="text-2xl sm:text-3xl font-bold text-gold-gradient tracking-widest font-mono relative z-10"
        >
          {referralCode || "—"}
        </span>
        <button
          type="button"
          onClick={handleCopyCode}
          className="text-sm font-medium text-gold-light underline underline-offset-4 hover:text-gold transition-colors cursor-pointer relative z-10"
        >
          {copiedCode ? "Đã chép!" : "Sao chép mã"}
        </button>
      </div>

      <div className="mt-4 max-w-[540px]">
        <div
          data-testid="referral-link-display"
          className="bg-surface-soft/80 rounded-xl px-4 py-3 text-xs sm:text-sm font-mono text-gold-light border border-gold/20 select-all break-all"
        >
          {shareLink}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleNativeShare}
            className="btn-primary h-10 px-5 text-xs sm:text-sm inline-flex items-center justify-center cursor-pointer select-none"
          >
            Chia sẻ
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="btn-secondary h-10 px-5 text-xs sm:text-sm inline-flex items-center justify-center cursor-pointer select-none"
          >
            {copiedLink ? "Đã chép liên kết!" : "Sao chép liên kết"}
          </button>
        </div>
      </div>

      <div className="mt-6 max-w-[540px] p-5 mystic-card rounded-xl">
        <span className="text-xs font-mono text-gold-dim uppercase font-bold tracking-wider block mb-2">
          Câu chia sẻ mẫu
        </span>
        <p
          data-testid="sample-share-text"
          className="text-xs sm:text-sm text-ink leading-relaxed italic bg-surface-soft/80 p-3 border border-gold/15 rounded-lg"
        >
          &ldquo;{sampleMessage}&rdquo;
        </p>
        <button
          type="button"
          onClick={handleCopyMessage}
          className="mt-3 text-xs font-medium text-gold-light underline underline-offset-4 hover:text-gold transition-colors cursor-pointer"
        >
          {copiedMessage ? "Đã chép câu mời!" : "Sao chép câu mời"}
        </button>
      </div>

      <div className="mt-8 max-w-[540px] p-5 rounded-xl bg-surface-soft/50 border border-gold/20">
        <h3 className="text-base font-display font-bold text-gold-light mb-3">Cách nhận credits</h3>
        <div className="flex flex-col gap-2 text-xs sm:text-sm text-body">
          <div><span className="text-gold font-mono mr-1.5">[+]</span> Mỗi người đăng ký bằng mã của bạn, bạn nhận +2 credits</div>
          <div><span className="text-gold font-mono mr-1.5">[+]</span> Tối đa 10 lượt thưởng mỗi ngày</div>
          <div><span className="text-gold font-mono mr-1.5">[+]</span> Người được bạn mời nhận +1 credit khi nhập mã của bạn</div>
        </div>
      </div>
    </div>
  );
};

export default ReferralShareCard;
