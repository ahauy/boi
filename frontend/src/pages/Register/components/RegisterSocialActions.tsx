import { Link } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";

interface RegisterSocialActionsProps {
  isSubmitting: boolean;
}

export const RegisterSocialActions = ({
  isSubmitting,
}: RegisterSocialActionsProps) => {
  return (
    <>
      <div className="mt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "[...] Đang đăng ký..." : "Tạo tài khoản"}
        </button>
      </div>

      <div className="mt-6 text-sm text-mute">
        Đã có tài khoản?{" "}
        <Link
          to={BaseUrl.Login}
          className="text-[#f7e7b4] underline hover:text-[#d4af37] font-medium"
        >
          Đăng nhập
        </Link>
      </div>
    </>
  );
};

export default RegisterSocialActions;
