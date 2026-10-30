import { Navigate } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";
import { useAuth } from "@/providers/AuthenticationProvider";
import ForgotPasswordForm from "./components/ForgotPasswordForm";

export const ForgotPassword = () => {
  const { isLogged } = useAuth();

  if (isLogged) {
    return <Navigate to={BaseUrl.Homepage} />;
  }

  return (
    <div className="component:ForgotPassword flex-1 w-full max-w-[960px] mx-auto flex items-center justify-center p-4 py-12 md:py-20 text-ink font-sans">
      <ForgotPasswordForm />
    </div>
  );
};

export default ForgotPassword;
