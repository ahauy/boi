import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import BaseUrl from "@/consts/baseUrl";
import authService from "@/services/authService";
import type { ApiErrorPayload } from "@/services/authService";
import type { UserDto } from "../types";

interface SecuritySectionProps {
  user: UserDto | null;
}

const actionClassName =
  "btn-primary h-9 px-4 text-xs inline-flex items-center justify-center shrink-0 select-none disabled:opacity-60";

export const SecuritySection = ({ user }: SecuritySectionProps) => {
  const hasPassword = Boolean(user?.hasPassword);
  const email = user?.email ?? null;

  const sendSetPasswordLink = useMutation({
    mutationFn: (to: string) => authService.postForgotPassword({ email: to }),
  });

  const sendError = sendSetPasswordLink.error as
    | { response?: { data?: { error?: ApiErrorPayload } } }
    | null;

  return (
    <section id="bao-mat" className="mt-16 scroll-mt-32 md:scroll-mt-24 font-sans text-ink">
      <div className="pb-3 border-b border-gold/25 flex items-center gap-2">
        <span className="text-gold text-sm">✦</span>
        <h2 className="text-2xl font-display font-bold text-gold-gradient">Bảo mật</h2>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {hasPassword ? (
          <div className="p-5 mystic-card rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-display font-bold text-gold-light">Mật khẩu tài khoản</h3>
              <p className="mt-1 text-xs text-mute leading-relaxed">
                Đổi mật khẩu định kỳ giúp bảo vệ tài khoản của bạn an toàn hơn.
              </p>
            </div>
            <Link to={BaseUrl.ChangePassword} className={actionClassName}>
              Đổi mật khẩu
            </Link>
          </div>
        ) : (
          <div className="p-5 mystic-card rounded-xl flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-display font-bold text-gold-light">Thiết lập mật khẩu</h3>
                <p className="mt-1 text-xs text-mute leading-relaxed">
                  Bạn đang chỉ đăng nhập được bằng Google/Facebook. Đặt mật khẩu để
                  có thêm cách đăng nhập bằng email.
                </p>
              </div>
              {email && !sendSetPasswordLink.isSuccess && (
                <button
                  type="button"
                  onClick={() => sendSetPasswordLink.mutate(email)}
                  disabled={sendSetPasswordLink.isPending}
                  className={actionClassName}
                >
                  {sendSetPasswordLink.isPending ? "Đang gửi..." : "Đặt mật khẩu"}
                </button>
              )}
            </div>

            {!email && (
              <p className="text-xs text-mute leading-relaxed">
                Tài khoản chưa có email nên chưa thể đặt mật khẩu.
              </p>
            )}

            {sendSetPasswordLink.isSuccess && (
              <p role="status" className="text-xs text-ink leading-relaxed">
                <span className="font-bold text-terminal-success mr-1">[✓]</span>
                Đã gửi link đặt mật khẩu tới <span className="font-bold">{email}</span>. Link
                có hiệu lực 1 giờ; kiểm tra cả thư mục Spam.
              </p>
            )}

            {sendSetPasswordLink.isError && (
              <p role="alert" className="text-xs text-ink leading-relaxed">
                <span className="font-bold text-terminal-danger mr-1">[!]</span>
                {sendError?.response?.data?.error?.message ||
                  "Không gửi được link lúc này. Vui lòng thử lại sau."}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default SecuritySection;
