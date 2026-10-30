import { useState } from "react";
import { Link } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";
import { useAuth } from "@/providers/AuthenticationProvider";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import type { UserDto } from "../types";

interface ProfileSectionProps {
  user: UserDto | null;
}

export const ProfileSection = ({ user }: ProfileSectionProps) => {
  const { logout } = useAuth();
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => {
      setCopiedId(false);
    }, 2000);
  };

  const loginProvidersText = () => {
    const list: string[] = [];
    if (user?.hasPassword) list.push("Mật khẩu");
    if (user?.providers?.includes("GOOGLE" as any)) list.push("Google");
    if (user?.providers?.includes("FACEBOOK" as any)) list.push("Facebook");
    return list.length > 0 ? list.join(" · ") : "Mật khẩu";
  };

  const initialLetter = (user?.displayName || user?.username || "P")
    .charAt(0)
    .toUpperCase();

  const handleScrollToEnter = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.replaceState(null, "", "#nhap-ma");
    const el = document.getElementById("nhap-ma");
    if (el) {
      el.scrollIntoView?.({ behavior: "smooth" });
    }
  };

  return (
    <section id="ho-so" className="scroll-mt-32 md:scroll-mt-24 font-sans text-ink">
      <div className="pb-3 border-b border-gold/25 flex items-center gap-2">
        <span className="text-gold text-sm">✦</span>
        <h2 className="text-2xl font-display font-bold text-gold-gradient">Hồ sơ</h2>
      </div>

      <div className="mt-6 mystic-card rounded-2xl p-6 relative overflow-hidden">
        <TarotCorners />
        <div className="flex items-start gap-5 relative z-10">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-16 h-16 rounded-full border-2 border-gold/50 object-cover shrink-0 shadow-gold-glow"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-surface-soft border-2 border-gold/40 flex items-center justify-center text-2xl font-display font-bold text-gold-light shrink-0 select-none shadow-gold-glow">
              {initialLetter}
            </div>
          )}

          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xl font-display font-bold text-gold-light">
              {user?.displayName || "Người dùng"}
            </span>
            <span className="text-sm font-mono text-mute">
              {user?.username ? `@${user.username}` : "Chưa có username"}
            </span>
            <div className="text-sm mt-1">
              <span className="text-body">{user?.email || "Không có email"}</span>
              {user?.email && (
                <span className="text-terminal-success font-mono text-xs font-medium ml-2 px-2 py-0.5 rounded-full bg-terminal-success/10 border border-terminal-success/30">
                  [+] Đã xác thực
                </span>
              )}
            </div>
            <span className="text-xs font-mono text-mute mt-1">
              Đăng nhập bằng: {loginProvidersText()}
            </span>
          </div>
        </div>

        <div className="mt-6 p-3.5 bg-surface-soft/80 border border-gold/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
          <div className="flex flex-col">
            <span className="text-[11px] font-mono text-gold-dim uppercase font-bold tracking-wider">
              ID tài khoản
            </span>
            <span
              data-testid="account-id-display"
              className="text-xs sm:text-sm font-mono text-gold-light break-all select-all mt-0.5"
            >
              {user?.id || "—"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyId}
            disabled={!user?.id}
            className="btn-secondary h-8 px-3 text-xs cursor-pointer self-start sm:self-auto"
          >
            {copiedId ? "Đã chép!" : "Sao chép"}
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col border-t border-gold/20">
        {user?.referral?.canEnterCode && (
          <a
            href="#nhap-ma"
            onClick={handleScrollToEnter}
            className="py-3.5 border-b border-gold/15 flex justify-between items-center hover:bg-surface-soft/50 px-3 rounded-lg transition-colors text-sm cursor-pointer"
          >
            <span className="text-gold-light">Nhập mã giới thiệu</span>
            <span className="text-gold font-mono">&gt;</span>
          </a>
        )}
        <Link
          to={BaseUrl.Privacy}
          className="py-3.5 border-b border-gold/15 flex justify-between items-center hover:bg-surface-soft/50 px-3 rounded-lg transition-colors text-sm"
        >
          <span className="text-ink">Chính sách riêng tư</span>
          <span className="text-gold font-mono">&gt;</span>
        </Link>
        <Link
          to={BaseUrl.Terms}
          className="py-3.5 border-b border-gold/15 flex justify-between items-center hover:bg-surface-soft/50 px-3 rounded-lg transition-colors text-sm"
        >
          <span className="text-ink">Điều khoản dịch vụ</span>
          <span className="text-gold font-mono">&gt;</span>
        </Link>
        <Link
          to={BaseUrl.DataDeletion}
          className="py-3.5 border-b border-gold/15 flex justify-between items-center hover:bg-surface-soft/50 px-3 rounded-lg transition-colors text-sm"
        >
          <span className="text-ink">Hướng dẫn xoá dữ liệu</span>
          <span className="text-gold font-mono">&gt;</span>
        </Link>
      </div>

      <div className="mt-6 p-5 bg-surface-soft/50 border border-gold/20 rounded-xl">
        <h3 className="text-sm font-bold text-gold-light">Yêu cầu xoá dữ liệu</h3>
        <p className="mt-1.5 text-xs text-mute leading-relaxed">
          Theo chính sách bảo mật, để xoá ảnh lòng bàn tay, kết quả bói và thông
          tin đăng nhập, vui lòng gửi email tới bộ phận hỗ trợ kèm ID tài khoản
          của bạn. Yêu cầu sẽ được xử lý trong vòng 30 ngày.
        </p>
        <div className="mt-3">
          <Link
            to={BaseUrl.DataDeletion}
            className="text-xs font-medium text-gold-light underline underline-offset-4 hover:text-gold transition-colors"
          >
            Xem hướng dẫn yêu cầu xoá dữ liệu &rarr;
          </Link>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gold/20 flex items-center justify-between">
        <button
          type="button"
          onClick={logout}
          className="btn-secondary h-9 px-5 text-sm cursor-pointer"
        >
          Đăng xuất
        </button>
      </div>
    </section>
  );
};

export default ProfileSection;
