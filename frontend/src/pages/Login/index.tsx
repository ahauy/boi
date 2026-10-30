import { Navigate } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";
import { useAuth } from "@/providers/AuthenticationProvider";
import LoginForm from "./components/LoginForm";

export const LoginPage = () => {
  const { isLogged } = useAuth();

  if (isLogged) {
    return <Navigate to={BaseUrl.Homepage} />;
  }

  return (
    <div className="component:Login flex-1 w-full flex items-center justify-center px-4 py-6 md:py-10">
      <LoginForm />
    </div>
  );
};

export default LoginPage;
