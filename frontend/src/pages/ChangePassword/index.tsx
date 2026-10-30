import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import PageWrapper from "@/components/PageWrapper";
import BaseUrl from "@/consts/baseUrl";
import ChangePasswordForm from "./components/ChangePasswordForm";

export const ChangePassword = () => {
  return (
    <PageWrapper>
      <div className="component:ChangePassword max-w-lg mx-auto py-8 px-4">
        <div className="mb-4">
          <Link
            to={BaseUrl.Account}
            className="text-xs font-rune text-[#f7e7b4]/80 hover:text-[#d4af37] transition-colors inline-flex items-center gap-1"
          >
            &larr; Quay lại Tài khoản
          </Link>
        </div>
        <div
          aria-hidden="true"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold mb-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Bảo Mật Huyền Môn</span>
        </div>
        <h1 className="mb-6 text-3xl sm:text-4xl font-bold font-display text-gold-gradient">
          Đổi mật khẩu
        </h1>
        <ChangePasswordForm />
      </div>
    </PageWrapper>
  );
};

export default ChangePassword;
