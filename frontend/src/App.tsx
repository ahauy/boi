import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "react-error-boundary";
import PrivateRoute from "@/components/PrivateRoute";
import AuthenticationProvider from "./providers/AuthenticationProvider";
import { ThemeProvider } from "./providers/ThemeProvider";
import i18n from "./i18n/config";
import Loading from "./components/ui/loading";
import { showError } from "./helpers/toast";
import BaseUrl from "./consts/baseUrl";
import DefaultLayout from "./layouts/DefaultLayout";

const Homepage = lazy(() => import("./pages/Homepage"));
const Login = lazy(() => import("./pages/Login"));
const RegisterPage = lazy(() => import("./pages/Register"));
const CheckEmailPage = lazy(() => import("./pages/CheckEmail"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const DataDeletion = lazy(() => import("./pages/DataDeletion"));
const Terms = lazy(() =>
  import("./pages/DataDeletion").then((module) => ({ default: module.Terms }))
);
const Privacy = lazy(() =>
  import("./pages/DataDeletion").then((module) => ({ default: module.Privacy }))
);
const ReferralRedirect = lazy(
  () => import("./pages/ReferralEnter/ReferralRedirect")
);
const Scan = lazy(() => import("./pages/Scan"));
const GuestReadingPreview = lazy(
  () => import("./pages/GuestReadingPreview")
);
const ReferralEnter = lazy(() => import("./pages/ReferralEnter"));
const Account = lazy(() => import("./pages/Account"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Referral = lazy(() => import("./pages/Referral"));
const ReadingsHistory = lazy(() => import("./pages/ReadingsHistory"));
const ReadingDetail = lazy(() => import("./pages/ReadingDetail"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Page404 = lazy(() => import("@/pages/Page404"));

const ErrorFallback = ({ error, resetErrorBoundary }: any) => {
  return (
    <div role="alert" className="p-8 text-center text-ink">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
};

const PageLoadingFallback = () => (
  <div className="p-8 flex items-center justify-center flex-1 min-h-[50vh]">
    <Loading />
  </div>
);

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) {
        showError(error);
      }
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  const renderContent = () => {
    return (
      <Router>
        <Routes>
          <Route element={<DefaultLayout />}>
            <Route
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <Outlet />
                </Suspense>
              }
            >
              <Route path={BaseUrl.Homepage} element={<Homepage />} />
              <Route path={BaseUrl.Login} element={<Login />} />
              <Route path={BaseUrl.Register} element={<RegisterPage />} />
              <Route path={BaseUrl.CheckEmail} element={<CheckEmailPage />} />
              <Route path={BaseUrl.VerifyEmail} element={<VerifyEmailPage />} />
              <Route path={BaseUrl.ForgotPassword} element={<ForgotPassword />} />
              <Route path={BaseUrl.ResetPassword} element={<ResetPassword />} />
              <Route path={BaseUrl.DataDeletion} element={<DataDeletion />} />
              <Route path={BaseUrl.Terms} element={<Terms />} />
              <Route path={BaseUrl.Privacy} element={<Privacy />} />
              <Route
                path={BaseUrl.ReferralRedirect}
                element={<ReferralRedirect />}
              />
              <Route path={BaseUrl.Scan} element={<Scan />} />
              <Route
                path={BaseUrl.GuestReadingPreview}
                element={<GuestReadingPreview />}
              />
              <Route path="*" element={<Page404 />} />
            </Route>

            <Route
              element={
                <Suspense
                  fallback={
                    <div className="p-2">
                      <Loading />
                    </div>
                  }
                >
                  <ErrorBoundary FallbackComponent={ErrorFallback}>
                    <PrivateRoute>
                      <Outlet />
                    </PrivateRoute>
                  </ErrorBoundary>
                </Suspense>
              }
            >
              <Route
                path={BaseUrl.ReferralEnter}
                element={<ReferralEnter />}
              />
              <Route
                path={BaseUrl.Account}
                element={<Account />}
              />
              <Route
                path={BaseUrl.Wallet}
                element={<Wallet />}
              />
              <Route
                path={BaseUrl.Referral}
                element={<Referral />}
              />
              <Route
                path={BaseUrl.Readings}
                element={<ReadingsHistory />}
              />
              <Route
                path={BaseUrl.ReadingDetail}
                element={<ReadingDetail />}
              />
              <Route
                path={BaseUrl.ChangePassword}
                element={<ChangePassword />}
              />
            </Route>
          </Route>
        </Routes>
      </Router>
    );
  };

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider defaultTheme="light" storageKey="theme">
        <QueryClientProvider client={queryClient}>
          <AuthenticationProvider>
            {renderContent()}
            <Toaster />
          </AuthenticationProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
};

export default App;
