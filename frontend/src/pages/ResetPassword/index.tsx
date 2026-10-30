import { Sparkles } from "lucide-react";
import ResetPasswordForm from "./components/ResetPasswordForm";

export const ResetPassword = () => {
  return (
    <div className="component:ResetPassword flex-1 w-full max-w-[980px] mx-auto my-12 md:my-20 px-4 flex flex-col md:flex-row gap-8 md:gap-0 items-start font-sans text-ink">
      <section className="w-full md:w-[360px] md:pr-10 flex flex-col items-start text-left">
        <div
          aria-hidden="true"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold mb-2"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Tái Lập Ấn Khóa</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#f7e7b4] leading-tight mb-3 tracking-normal">
          Đặt lại mật khẩu
        </h1>
        <p className="text-base text-body mb-6">
          Chọn mật khẩu mới cho tài khoản của bạn.
        </p>

        <div className="w-full space-y-3 border-t border-hairline pt-5">
          <div className="p-3 rounded-xl bg-[#0b0716]/60 border border-hairline/70 text-sm text-body flex items-center">
            <span className="font-bold text-[#d4af37] mr-2.5 font-rune">[+]</span>
            <span>Mật khẩu tối thiểu 8 ký tự</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0b0716]/60 border border-hairline/70 text-sm text-body flex items-center">
            <span className="font-bold text-[#d4af37] mr-2.5 font-rune">[+]</span>
            <span>Thu hồi toàn bộ phiên đăng nhập cũ</span>
          </div>
        </div>
      </section>

      <div className="hidden md:block w-[1px] bg-hairline self-stretch min-h-[360px]" />

      <section className="w-full md:w-[480px] md:pl-10 flex flex-col items-start text-left">
        <ResetPasswordForm />
      </section>
    </div>
  );
};

export default ResetPassword;
