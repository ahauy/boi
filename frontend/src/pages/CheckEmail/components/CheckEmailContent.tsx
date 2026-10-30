import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import useResendVerification from "../hooks/useResendVerification";
import type { ApiErrorPayload } from "@/services/authService";

const COOLDOWN_SECONDS = 60;

const StepsSection = () => (
  <div className="flex flex-col p-5 rounded-xl bg-surface-soft/70 border border-gold/20">
    <div className="font-display font-bold text-gold-light text-lg pb-2">Làm theo 3 bước</div>
    <div className="h-[1px] w-full bg-gold/15" />
    <div className="py-2.5 flex items-center text-sm sm:text-base text-body">
      <span className="font-bold font-mono text-gold mr-2">[+]</span> Mở email từ PalmSight
    </div>
    <div className="h-[1px] w-full bg-gold/15" />
    <div className="py-2.5 flex items-center text-sm sm:text-base text-body">
      <span className="font-bold font-mono text-gold mr-2">[+]</span> Bấm vào link xác thực
    </div>
    <div className="h-[1px] w-full bg-gold/15" />
    <div className="py-2.5 flex items-center text-sm sm:text-base text-body">
      <span className="font-bold font-mono text-gold mr-2">[+]</span> Quay lại để đăng nhập
    </div>
  </div>
);

export const CheckEmailContent = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const resendMutation = useResendVerification();

  const rawEmail =
    (location.state as { email?: string })?.email ||
    searchParams.get("email") ||
    "";
  const email = rawEmail.trim();

  const [cooldown, setCooldown] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 5000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resendMutation.isPending) return;

    if (!email) {
      setErrorMessage(
        "Không tìm thấy địa chỉ email để gửi lại xác minh. Vui lòng quay lại trang đăng ký."
      );
      return;
    }

    setErrorMessage(null);
    try {
      await resendMutation.mutateAsync({ email });
      setToastMessage("Đã gửi lại email xác minh thành công.");
      setCooldown(COOLDOWN_SECONDS);
    } catch (err: any) {
      const response = err?.response;
      const apiError = (response?.data?.error || {}) as ApiErrorPayload;
      if (response?.status === 429) {
        setErrorMessage(
          apiError.message ||
            "Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút."
        );
      } else {
        setErrorMessage(
          apiError.message ||
            "Không thể gửi lại email vào lúc này. Vui lòng thử lại sau."
        );
      }
    }
  }, [cooldown, resendMutation, email]);

  const isResending = resendMutation.isPending;

  return (
    <div className="w-full max-w-[560px] mystic-card rounded-2xl p-6 sm:p-10 relative overflow-hidden flex flex-col">
      <TarotCorners />
      {toastMessage && (
        <div
          role="status"
          data-testid="toast-success"
          className="mb-6 p-3.5 bg-terminal-success/10 border border-terminal-success/40 text-ink rounded-xl text-sm flex items-start gap-2 relative z-10"
        >
          <span className="font-bold text-terminal-success">[✓]</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-3.5 bg-error-container/30 border border-terminal-danger/50 text-ink rounded-xl text-sm flex items-start gap-2 relative z-10"
        >
          <span className="font-bold text-terminal-danger">[!]</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-gold mb-2 relative z-10">
        <span>✦</span>
        <span>Tín Hiệu Tinh Cầu</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-display font-bold text-gold-gradient tracking-normal leading-tight relative z-10">
        Kiểm tra hộp thư của bạn
      </h1>

      <div className="h-4" />

      <div className="flex flex-col relative z-10">
        <p className="text-base text-body">
          Đã gửi link xác minh tới{" "}
          <span className="font-bold text-gold-light" data-testid="user-email">
            {email || "hộp thư của bạn"}
          </span>
        </p>
        <div className="h-2" />
        <p className="text-sm text-mute">Link có hiệu lực trong 24 giờ.</p>
      </div>

      <div className="h-6" />
      <div className="relative z-10">
        <StepsSection />
      </div>
      <div className="h-6" />

      <div className="flex flex-wrap items-center gap-4 relative z-10">
        <button
          id="resend-btn"
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          className={`h-10 px-5 rounded-lg font-medium text-sm transition-all duration-150 ${
            cooldown > 0 || isResending
              ? "bg-surface-soft text-ash border border-gold/15 cursor-not-allowed select-none"
              : "btn-primary cursor-pointer"
          }`}
        >
          {isResending
            ? "[...] Đang gửi..."
            : cooldown > 0
            ? `Gửi lại sau (${cooldown}s)...`
            : "Gửi lại email xác minh"}
        </button>

        <Link
          to={BaseUrl.Register}
          className="text-sm text-gold-light underline underline-offset-4 hover:text-gold transition-colors"
        >
          Dùng email khác
        </Link>
      </div>

      <div className="h-6" />

      <div className="p-3.5 px-4 bg-surface-soft/50 border border-gold/15 rounded-xl relative z-10">
        <p className="text-sm text-body">
          <span className="font-medium font-mono text-gold mr-1">[i]</span> Không thấy email?
          Kiểm tra thư mục spam.
        </p>
      </div>
    </div>
  );
};

export default CheckEmailContent;
