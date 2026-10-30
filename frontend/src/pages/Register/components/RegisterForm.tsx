import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import * as yup from "yup";
import { registerFormSchema } from "@palmsight/shared";
import { getCookie } from "@/helpers/cookie";
import { showError } from "@/helpers/toast";
import BaseUrl from "@/consts/baseUrl";
import RegisterFormFields from "./RegisterFormFields";
import RegisterSocialActions from "./RegisterSocialActions";
import useRegisterMutation from "../hooks/useRegisterMutation";
import type { RegisterFormValues } from "../types";
import type { ApiErrorPayload } from "@/services/authService";

export const registerValidationSchema = registerFormSchema.shape({
  termsAccepted: yup
    .boolean()
    .oneOf([true], "Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách riêng tư.")
    .required("Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách riêng tư."),
});

const handleSubmissionError = (
  err: any,
  setErrors: (errors: Record<string, string>) => void,
  setGeneralError: (msg: string | null) => void
) => {
  const response = err?.response;
  const status = response?.status;
  const apiError = (response?.data?.error || {}) as ApiErrorPayload;

  if (status === 409) {
    if (apiError.code === "EMAIL_TAKEN") {
      const errorMessage = apiError.message || "Email này đã được sử dụng.";
      setErrors({ email: errorMessage });
      showError(errorMessage);
    } else if (apiError.code === "USERNAME_TAKEN") {
      setErrors({ username: apiError.message || "Tên người dùng đã được sử dụng." });
    } else {
      const message = apiError.message || "Thông tin đăng ký bị xung đột.";
      setGeneralError(message);
      showError(message);
    }
  } else if (status === 400 && apiError.details?.fields) {
    const serverErrors: Record<string, string> = {};
    apiError.details.fields.forEach((f) => {
      serverErrors[f.field] = f.message;
    });
    setErrors(serverErrors);
  } else if (status === 429) {
    const message =
      apiError.message || "Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau ít phút.";
    setGeneralError(message);
    showError(message);
  } else {
    const message = apiError.message || "Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.";
    setGeneralError(message);
    showError(message);
  }
};

export const RegisterForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const registerMutation = useRegisterMutation();

  const initialReferralCode = useMemo(() => {
    const fromQuery = searchParams.get("ref") || searchParams.get("referralCode");
    const fromCookie = getCookie("ref_code");
    return (fromQuery || fromCookie || "").trim().toUpperCase();
  }, [searchParams]);

  const claimToken = useMemo(() => {
    const fromQuery = searchParams.get("claimToken");
    let fromStorage: string | null = null;
    try {
      fromStorage =
        sessionStorage.getItem("ps_claim_token") ||
        localStorage.getItem("ps_claim_token");
    } catch {
      // Storage unavailable fallback
    }
    const token = (fromQuery || fromStorage || "").trim();
    return token || undefined;
  }, [searchParams]);

  const initialValues: RegisterFormValues = {
    displayName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    referralCode: initialReferralCode,
    termsAccepted: false,
  };

  const onSubmit = async (
    values: RegisterFormValues,
    { setErrors, setSubmitting }: FormikHelpers<RegisterFormValues>
  ) => {
    setGeneralError(null);
    try {
      const payload = {
        displayName: values.displayName.trim(),
        username: values.username.trim().toLowerCase(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        ...(values.referralCode?.trim()
          ? { referralCode: values.referralCode.trim().toUpperCase() }
          : {}),
        ...(claimToken ? { claimToken } : {}),
      };

      const result = await registerMutation.mutateAsync(payload);
      const queryParams = new URLSearchParams();
      queryParams.set("email", result.email || values.email);
      if (claimToken) {
        queryParams.set("claimToken", claimToken);
      }
      navigate(
        `${BaseUrl.CheckEmail}?${queryParams.toString()}`,
        { state: { email: result.email || values.email, claimToken } }
      );
    } catch (err: any) {
      handleSubmissionError(err, setErrors, setGeneralError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="w-full md:w-[480px] md:pl-12">
      {claimToken && (
        <div
          data-testid="claim-token-banner"
          className="mb-6 p-3.5 bg-[#140d26]/85 border border-[#d4af37]/60 text-ink rounded text-xs sm:text-sm flex items-center gap-2 font-rune"
        >
          <span className="font-bold text-[#f5d77f]">[#]</span>
          <span>
            Bạn đang có 1 bài bói thử. Tài khoản sẽ tự động mở khóa 100% sau khi xác thực email!
          </span>
        </div>
      )}

      {generalError && (
        <div
          role="alert"
          className="mb-6 p-3 bg-error-container/30 border border-terminal-danger text-ink rounded text-sm flex items-start gap-2"
        >
          <span className="font-bold text-terminal-danger">[!]</span>
          <span>{generalError}</span>
        </div>
      )}

      <Formik
        initialValues={initialValues}
        validationSchema={registerValidationSchema}
        onSubmit={onSubmit}
        validateOnBlur
        validateOnChange
      >
        {({ isSubmitting }) => (
          <Form noValidate>
            <RegisterFormFields isSubmitting={isSubmitting} />
            <RegisterSocialActions isSubmitting={isSubmitting} />
          </Form>
        )}
      </Formik>
    </section>
  );
};

export default RegisterForm;
