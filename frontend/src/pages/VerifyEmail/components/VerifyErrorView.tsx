import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import { useResendVerificationMutation } from "../hooks/useVerifyEmail";
import type { ApiErrorPayload } from "@/services/authService";

interface VerifyErrorViewProps {
  errorMessage: string | null;
}

export const VerifyErrorView = ({ errorMessage }: VerifyErrorViewProps) => {
  const [resendEmail, setResendEmail] = useState<string>("");
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const resendMutation = useResendVerificationMutation();

  const handleResendSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setResendError(null);
    setResendSuccess(false);

    try {
      await resendMutation.mutateAsync({ email: resendEmail.trim() });
      setResendSuccess(true);
    } catch (err: any) {
      const apiError = (err?.response?.data?.error || {}) as ApiErrorPayload;
      setResendError(
        apiError.message ||
          "Không thể gửi lại email vào lúc này. Vui lòng thử lại sau."
      );
    }
  };

  return (
    <div data-testid="verify-error" className="w-full flex flex-col items-start">
      <div className="p-5 bg-error-container/30 border border-terminal-danger/50 rounded-xl w-full mb-6">
        <div className="flex items-start gap-2.5 text-ink">
          <span className="font-bold font-mono text-terminal-danger text-lg">[!]</span>
          <div>
            <h2 className="text-base font-bold text-ink">
              {errorMessage ||
                "Liên kết xác minh không hợp lệ hoặc đã hết hạn (quá 24 giờ)."}
            </h2>
            <p className="text-sm text-mute mt-1">
              Liên kết này có thể đã được sử dụng hoặc đã quá hạn 24 giờ.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full p-6 mystic-card rounded-2xl relative overflow-hidden mb-6">
        <TarotCorners />
        <div className="relative z-10">
          <h3 className="text-xl font-display font-bold text-gold-light mb-1">
            Gửi lại link xác minh
          </h3>
          <p className="text-sm text-mute mb-4">
            Nhập email đăng ký của bạn để nhận liên kết xác thực mới.
          </p>

          {resendSuccess ? (
            <div className="p-3.5 bg-terminal-success/10 border border-terminal-success/40 rounded-xl text-sm text-ink flex items-center gap-2">
              <span className="font-bold text-terminal-success">[✓]</span>
              <span>Nếu email tồn tại, link xác minh mới đã được gửi.</span>
            </div>
          ) : (
            <form onSubmit={handleResendSubmit} className="flex flex-col gap-3">
              {resendError && (
                <p className="text-sm text-terminal-danger flex items-center gap-1">
                  <span className="font-bold">[!]</span> {resendError}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  aria-label="Email nhận lại link xác minh"
                  placeholder="minhanh@example.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  disabled={resendMutation.isPending}
                  className="flex-1 h-10 bg-surface-soft/80 border border-gold/30 rounded-lg px-3.5 text-sm text-ink placeholder:text-ash outline-none focus:border-gold"
                />
                <button
                  type="submit"
                  disabled={resendMutation.isPending || !resendEmail.trim()}
                  className="btn-primary h-10 px-5 text-sm disabled:opacity-50 cursor-pointer"
                >
                  {resendMutation.isPending ? "[...] Đang gửi..." : "Gửi lại link xác minh"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div>
        <Link
          to={BaseUrl.Login}
          className="text-sm text-gold-light underline underline-offset-4 hover:text-gold transition-colors"
        >
          Quay lại Đăng nhập
        </Link>
      </div>
    </div>
  );
};

export default VerifyErrorView;
