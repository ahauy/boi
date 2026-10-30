import { useState } from "react";
import { Link } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";
import { showSuccess } from "@/helpers/toast";
import type { UserDto } from "../types";

interface ReferralSectionProps {
  user: UserDto | null;
}

export const ReferralSection = ({ user }: ReferralSectionProps) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const referralCode = user?.referralCode || "";
  const domain =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://palmsight.app";
  const shareLink = user?.referralLink || `${domain}/r/${referralCode}`;
  const sampleMessage = referralCode
    ? `Nhập mã ${referralCode} trên PalmSight: bạn được thêm 1 credit xem bói miễn phí`
    : "";

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    showSuccess("Đã sao chép mã giới thiệu!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    showSuccess("Đã sao chép liên kết giới thiệu!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    if (!sampleMessage) return;
    navigator.clipboard.writeText(sampleMessage);
    setCopiedMessage(true);
    showSuccess("Đã sao chép câu mời mẫu!");
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  return (
    <section id="gioi-thieu" className="mt-16 pb-12 scroll-mt-32 md:scroll-mt-24 font-sans text-ink">
      <div className="pb-3 border-b border-gold/25 flex items-center gap-2">
        <span className="text-gold text-sm">✦</span>
        <h2 className="text-2xl font-display font-bold text-gold-gradient">Giới thiệu</h2>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <div>
          <h3 className="text-xs font-mono text-gold-dim uppercase font-bold tracking-wider mb-2">
            Mã độc bản của tôi
          </h3>
          <div className="max-w-[500px] mystic-card rounded-xl p-4 flex justify-between items-center">
            <span
              data-testid="referral-code-display"
              className="text-2xl sm:text-3xl font-bold text-gold-gradient tracking-widest font-mono select-all"
            >
              {referralCode || "—"}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              disabled={!referralCode}
              className="btn-secondary h-8 px-3 text-xs cursor-pointer"
            >
              {copiedCode ? "Đã chép!" : "Sao chép mã"}
            </button>
          </div>
        </div>

        <div className="max-w-[500px]">
          <h3 className="text-xs font-mono text-gold-dim uppercase font-bold tracking-wider mb-2">
            Liên kết giới thiệu
          </h3>
          <div
            data-testid="referral-link-display"
            className="bg-surface-soft/80 rounded-xl px-4 py-3 text-xs sm:text-sm font-mono text-gold-light border border-gold/20 select-all break-all"
          >
            {shareLink}
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!shareLink}
              className="btn-secondary h-9 px-4 text-xs inline-flex items-center justify-center cursor-pointer select-none"
            >
              {copiedLink ? "Đã chép liên kết!" : "Sao chép liên kết"}
            </button>
          </div>
        </div>

        <div className="max-w-[500px] p-5 mystic-card rounded-xl">
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
            disabled={!sampleMessage}
            className="mt-3 text-xs font-medium text-gold-light underline underline-offset-4 hover:text-gold transition-colors cursor-pointer"
          >
            {copiedMessage ? "Đã chép câu mời!" : "Sao chép câu mời"}
          </button>
        </div>

        <div className="pt-3 border-t border-gold/20">
          <Link
            to={BaseUrl.Referral}
            className="text-xs sm:text-sm font-medium text-gold-light underline underline-offset-4 hover:text-gold transition-colors inline-flex items-center gap-1"
          >
            Mời bạn bè nhận credit (Xem chi tiết danh sách người đã mời) &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ReferralSection;
