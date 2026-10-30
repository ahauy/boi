import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import BaseUrl from "@/consts/baseUrl";
import Loading from "@/components/ui/loading";
import { useAuth } from "@/providers/AuthenticationProvider";

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const auth = useAuth();
  const location = useLocation();

  //! Render
  // 1. If user is authenticated (including optimistic session from storage), render immediately
  if (auth.isLogged) {
    return <>{children}</>;
  }

  // 2. If still verifying unknown session on initial load (no cached user), show loading indicator
  if (auth.loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]" role="status" aria-label="Đang tải">
        <Loading />
      </div>
    );
  }

  // 3. Definitely unauthenticated, redirect to login
  return <Navigate to={BaseUrl.Login} state={{ from: location }} replace />;
};

export default PrivateRoute;
