import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import { Sparkles } from "lucide-react";
import { loginSchema } from "@palmsight/shared";
import FormikField from "@/components/customFieldsFormik/FormikField";
import InputField from "@/components/customFieldsFormik/InputField";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import { useToast } from "@/components/ui/use-toast";
import BaseUrl from "@/consts/baseUrl";
import { useAuth } from "@/providers/AuthenticationProvider";
import useLoginMutation from "../hooks/useLoginMutation";
import type { LoginFormValues } from "../types";

const inputClassName =
  "w-full h-11 bg-[#0b0716]/75 border border-hairline rounded-xl px-3.5 py-2 text-ink placeholder:text-ash text-base outline-none focus:bg-[#0b0716] focus:border-[#d4af37] focus:shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all disabled:opacity-50";

export const LoginForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { setAuthSession } = useAuth();
  const loginMutation = useLoginMutation();
  const isResetSuccess = searchParams.get("reset") === "1";

  const initialValues: LoginFormValues = {
    login: "",
    password: "",
  };

  const onSubmit = async (
    values: LoginFormValues,
    { setSubmitting }: FormikHelpers<LoginFormValues>
  ) => {
    try {
      const data = await loginMutation.mutateAsync({
        login: values.login.trim().toLowerCase(),
        password: values.password,
      });

      setAuthSession({
        accessToken: data.accessToken,
        user: data.user,
      });

      const destination = data.isNewUser
        ? BaseUrl.ReferralEnter
        : BaseUrl.Scan;
      navigate(destination);
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.";
      toast({
        variant: "destructive",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative w-full max-w-md mystic-card rounded-2xl p-7 sm:p-9">
      <TarotCorners />
      <div
        aria-hidden="true"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-[#d4af37] font-semibold mb-2"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Cổng Huyền Môn</span>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#f7e7b4] leading-tight tracking-normal">
        Đăng nhập
      </h1>
      <p className="text-sm text-body mt-1 mb-6">
        Dùng email hoặc tên đăng nhập của bạn.
      </p>

      {isResetSuccess && (
        <div
          role="status"
          className="mb-5 p-3.5 bg-[#0b0716]/80 border border-terminal-success rounded-xl text-sm text-ink flex items-start gap-2"
        >
          <span className="font-bold text-terminal-success">[✓]</span>
          <span>
            Đã đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.
          </span>
        </div>
      )}

      <Formik
        initialValues={initialValues}
        validationSchema={loginSchema}
        onSubmit={onSubmit}
      >
        {({ isSubmitting }) => (
          <Form noValidate className="flex flex-col gap-4">
            <FormikField
              component={InputField}
              name="login"
              label="Email hoặc username"
              autoComplete="username"
              placeholder="minhanh@example.com"
              showTerminalIcons
              disabled={isSubmitting}
              className={inputClassName}
            />

            <div className="relative">
              <FormikField
                component={InputField}
                name="password"
                type="password"
                label="Mật khẩu"
                autoComplete="current-password"
                placeholder="••••••••"
                passwordToggleStyle="text"
                showTerminalIcons
                disabled={isSubmitting}
                className={inputClassName}
              />
              <Link
                to={BaseUrl.ForgotPassword}
                className="absolute right-0 top-0 text-xs sm:text-sm text-[#d4af37] underline hover:text-[#f7e7b4]"
              >
                Quên mật khẩu?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "[...] Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </Form>
        )}
      </Formik>

      <SocialLoginButtons />

      <p className="mt-6 text-center text-sm text-mute">
        Chưa có tài khoản?{" "}
        <Link
          to={BaseUrl.Register}
          className="text-[#f7e7b4] underline hover:text-[#d4af37] font-medium"
        >
          Tạo tài khoản mới
        </Link>
      </p>
    </section>
  );
};

export default LoginForm;
