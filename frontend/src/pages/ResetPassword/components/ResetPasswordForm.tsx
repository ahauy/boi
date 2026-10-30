import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import { resetPasswordFormSchema } from "@palmsight/shared";
import FormikField from "@/components/customFieldsFormik/FormikField";
import InputField from "@/components/customFieldsFormik/InputField";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import BaseUrl from "@/consts/baseUrl";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import useResetPasswordMutation from "../hooks/useResetPasswordMutation";
import type { ResetPasswordFormValues } from "../types";
import type { ApiErrorPayload } from "@/services/authService";
import { useAuth } from "@/providers/AuthenticationProvider";

export const ResetPasswordForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isLogged, logout } = useAuth();
  const resetPasswordMutation = useResetPasswordMutation();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const tokenFromUrl = (searchParams.get("token") || "").trim();

  const initialValues: ResetPasswordFormValues = {
    token: tokenFromUrl,
    newPassword: "",
    confirmPassword: "",
  };

  const onSubmit = async (
    values: ResetPasswordFormValues,
    { setErrors, setSubmitting }: FormikHelpers<ResetPasswordFormValues>
  ) => {
    setGeneralError(null);

    const tokenToUse = values.token || tokenFromUrl;
    if (!tokenToUse) {
      const missingTokenMsg =
        "Không tìm thấy mã xác thực trong đường dẫn. Vui lòng mở lại liên kết từ email.";
      setGeneralError(missingTokenMsg);
      toast({
        variant: "destructive",
        description: missingTokenMsg,
      });
      setSubmitting(false);
      return;
    }

    try {
      await resetPasswordMutation.mutateAsync({
        token: tokenToUse,
        newPassword: values.newPassword,
      });

      toast({
        description: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.",
      });

      if (isLogged) logout();

      navigate(`${BaseUrl.Login}?reset=1`);
    } catch (error: any) {
      const apiError = error?.response?.data?.error as ApiErrorPayload | undefined;
      const errorCode = apiError?.code;

      if (errorCode === "RESET_TOKEN_INVALID") {
        const message =
          apiError?.message ||
          "Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được sử dụng.";
        setGeneralError(message);
        toast({
          variant: "destructive",
          description: message,
        });
      } else if (errorCode === "VALIDATION_ERROR") {
        if (apiError?.details?.fields) {
          const fieldErrors: Record<string, string> = {};
          apiError.details.fields.forEach((f) => {
            fieldErrors[f.field] = f.message;
          });
          setErrors(fieldErrors);
        }
        const message =
          apiError?.message || "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại.";
        setGeneralError(message);
        toast({
          variant: "destructive",
          description: message,
        });
      } else {
        const message =
          apiError?.message ||
          error?.message ||
          "Có lỗi xảy ra khi đặt lại mật khẩu. Vui lòng thử lại sau.";
        setGeneralError(message);
        toast({
          variant: "destructive",
          description: message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {!tokenFromUrl && (
        <div
          role="alert"
          className="mb-4 p-3.5 bg-error-container/30 border border-terminal-danger/50 text-ink rounded-xl text-sm flex items-start gap-2"
        >
          <span className="font-bold text-terminal-danger">[!]</span>
          <span>
            Không tìm thấy mã xác thực trong đường dẫn. Vui lòng mở lại liên kết từ email của bạn.
          </span>
        </div>
      )}

      {generalError && (
        <div
          role="alert"
          className="mb-4 p-3.5 bg-error-container/30 border border-terminal-danger/50 text-ink rounded-xl text-sm flex items-start gap-2"
        >
          <span className="font-bold text-terminal-danger">[!]</span>
          <span>{generalError}</span>
        </div>
      )}

      <Card className="w-full mystic-card rounded-2xl relative overflow-hidden">
        <TarotCorners />
        <CardContent className="p-6 sm:p-8 relative z-10">
          <Formik
            initialValues={initialValues}
            validationSchema={resetPasswordFormSchema}
            onSubmit={onSubmit}
            validateOnBlur
            validateOnChange
          >
            {({ isSubmitting, errors, touched }) => (
              <Form noValidate className="w-full flex flex-col gap-4">
                <input type="hidden" name="token" value={tokenFromUrl} />

                {touched.token && errors.token && (
                  <p className="text-sm text-terminal-danger flex items-center gap-1">
                    <span className="font-bold">[!]</span>
                    <span>{errors.token}</span>
                  </p>
                )}

                <FormikField
                  component={InputField}
                  name="newPassword"
                  type="password"
                  label="Mật khẩu mới"
                  placeholder="••••••••"
                  required
                  helperText="Tối thiểu 8 ký tự."
                  showTerminalIcons
                  passwordToggleStyle="text"
                  disabled={isSubmitting}
                />

                <FormikField
                  component={InputField}
                  name="confirmPassword"
                  type="password"
                  label="Xác nhận mật khẩu"
                  placeholder="••••••••"
                  required
                  showTerminalIcons
                  passwordToggleStyle="text"
                  disabled={isSubmitting}
                />

                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  className="w-full h-11 btn-primary text-base mt-2"
                >
                  Đặt lại mật khẩu
                </Button>
              </Form>
            )}
          </Formik>

          <p className="text-center text-sm text-mute mt-5">
            Đã nhớ mật khẩu?{" "}
            <Link to={BaseUrl.Login} className="is-link text-gold-light font-semibold underline hover:text-gold">
              Đăng nhập
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordForm;
