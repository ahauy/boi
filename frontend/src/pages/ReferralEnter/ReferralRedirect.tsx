import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { setCookie } from "@/helpers/cookie";
import BaseUrl from "@/consts/baseUrl";

export const ReferralRedirect = () => {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      const sanitizedCode = code.trim().toUpperCase();
      setCookie("ref_code", sanitizedCode, 30);
    }
    navigate(BaseUrl.Register, { replace: true });
  }, [code, navigate]);

  return (
    <div className="w-full min-h-[50vh] flex items-center justify-center font-mono text-sm text-mute">
      Đang chuyển hướng tới trang đăng ký...
    </div>
  );
};

export default ReferralRedirect;
