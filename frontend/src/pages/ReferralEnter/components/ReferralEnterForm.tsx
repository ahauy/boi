import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Formik, Form, FormikHelpers } from "formik";
import { enterReferralSchema } from "@palmsight/shared";
import { getCookie, deleteCookie } from "@/helpers/cookie";
import { showSuccess } from "@/helpers/toast";
import { useAuth } from "@/providers/AuthenticationProvider";
import BaseUrl from "@/consts/baseUrl";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import useEnterReferralMutation from "../hooks/useEnterReferralMutation";
import type { ReferralEnterFormValues } from "../types";
import type { ApiErrorPayload } from "@/services/authService";

const ERROR_MESSAGE_MAP: Record<string, string> = {
  REFERRAL_NOT_ALLOWED: "Tài khoản này không thể nhập mã giới thiệu.",
  REFERRAL_CODE_NOT_FOUND: "Mã không tồn tại, kiểm tra lại",
  REFERRAL_SELF: "Bạn không thể nhập mã của chính mình",
  REFERRAL_ALREADY_USED: "Tài khoản đã nhập mã giới thiệu trước đó",
  REFERRAL_CYCLE: "Không thể nhập mã của người bạn đã mời",
};

export const ReferralEnterForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updateUser } = useAuth();
  const enterReferralMutation = useEnterReferralMutation();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const initialCode = useMemo(() => {
    const fromQuery = searchParams.get("code") || searchParams.get("ref");
    const fromCookie = getCookie("ref_code");
    return (fromQuery || fromCookie || "").trim().toUpperCase();
  }, [searchParams]);

  const initialValues: ReferralEnterFormValues = {
    code: initialCode,
  };

  const handleSkip = () => {
    navigate(BaseUrl.Scan);
  };

  const handleSubmit = async (
    values: ReferralEnterFormValues,
    { setSubmitting, setFieldError }: FormikHelpers<ReferralEnterFormValues>
  ) => {
    setGeneralError(null);
    try {
      const trimmedCode = values.code.trim().toUpperCase();
      const response = await enterReferralMutation.mutateAsync({
        code: trimmedCode,
      });

      if (typeof response.creditBalance === "number") {
        updateUser({
          creditBalance: response.creditBalance,
        });
      }

      deleteCookie("ref_code");

      const referrerName = response.referrer?.displayName || "bạn bè";
      showSuccess(
        `Đã ghi nhận mã của ${referrerName}. Bạn nhận được ${response.creditsEarned} credit!`
      );

      navigate(BaseUrl.Scan);
    } catch (err: any) {
      const response = err?.response;
      const apiError = (response?.data?.error || {}) as ApiErrorPayload;
      const errorCode = apiError.code;

      if (errorCode && ERROR_MESSAGE_MAP[errorCode]) {
        setGeneralError(ERROR_MESSAGE_MAP[errorCode]);
      } else if (response?.status === 400 && apiError.details?.fields) {
        apiError.details.fields.forEach((fieldError) => {
          if (fieldError.field === "code") {
            setFieldError("code", fieldError.message);
          }
        });
        setGeneralError(apiError.message || "Mã giới thiệu không hợp lệ.");
      } else {
        setGeneralError(
          apiError.message ||
            "Không thể xử lý mã giới thiệu. Vui lòng kiểm tra lại."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[960px] mx-auto px-4 sm:px-6 pt-12 md:pt-20 pb-24 font-sans">
      <div className="grid grid-cols-1 md:grid-cols-[360px_1px_480px] gap-y-8 md:gap-y-0 justify-between items-start">
        <section className="w-full md:w-[360px] flex flex-col text-left">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-gold mb-2">
            <span>✦</span>
            <span>Ấn Ký Tri Kỷ</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display text-gold-gradient font-bold leading-tight m-0 p-0">
            Nhập mã giới thiệu
          </h1>
          <div className="h-4" />
          <p className="text-base text-body leading-relaxed m-0 p-0">
            Nếu có người mời bạn, nhập mã để họ nhận 2 credits. Bạn có thể bỏ
            qua bước này.
          </p>
          <div className="h-4" />
          <p className="text-sm text-mute leading-relaxed m-0 p-0">
            Bạn có thể nhập mã sau trong mục Tài khoản.
          </p>
        </section>

        <div
          aria-hidden="true"
          className="hidden md:block w-px self-stretch bg-gradient-to-b from-transparent via-gold/25 to-transparent"
        />

        <section className="w-full md:w-[480px] mystic-card rounded-2xl p-6 sm:p-8 relative overflow-hidden flex flex-col text-left">
          <TarotCorners />
          <Formik
            initialValues={initialValues}
            validationSchema={enterReferralSchema}
            onSubmit={handleSubmit}
            enableReinitialize
          >
            {({
              values,
              errors,
              touched,
              handleChange,
              handleBlur,
              isSubmitting,
            }) => (
              <Form
                className="w-full flex flex-col m-0 p-0 relative z-10"
                noValidate
                data-testid="referral-enter-form"
              >
                {generalError && (
                  <div
                    role="alert"
                    className="p-3 mb-4 text-sm border border-terminal-danger/40 bg-error-container/30 text-terminal-danger rounded-lg"
                  >
                    {generalError}
                  </div>
                )}

                <label
                  htmlFor="referral-code"
                  className="text-xs font-mono uppercase tracking-wider font-bold text-gold-light mb-2 block cursor-pointer"
                >
                  Mã giới thiệu
                </label>
                <input
                  id="referral-code"
                  name="code"
                  type="text"
                  maxLength={8}
                  autoComplete="off"
                  spellCheck={false}
                  value={values.code}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    handleChange(e);
                  }}
                  onBlur={handleBlur}
                  placeholder="K7QX4MZP"
                  className="w-full h-11 px-4 py-2 bg-surface-soft/80 text-gold-light border border-gold/30 rounded-lg text-base font-mono tracking-[3px] uppercase outline-none focus:border-gold transition-all"
                  aria-invalid={Boolean(touched.code && errors.code)}
                />

                {touched.code && errors.code ? (
                  <div className="text-xs text-terminal-danger mt-1.5">
                    {errors.code}
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-mute leading-relaxed">
                    <span className="select-none font-bold text-gold">[i]</span>
                    <span>Mã gồm 8 ký tự.</span>
                  </div>
                )}

                <div className="h-6" />

                <div className="flex items-center justify-start gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary h-10 px-6 text-sm cursor-pointer select-none text-center disabled:opacity-50"
                  >
                    {isSubmitting ? "Đang xử lý..." : "Xác nhận"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={isSubmitting}
                    className="btn-secondary h-10 px-6 text-sm cursor-pointer select-none text-center"
                  >
                    Bỏ qua
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </section>
      </div>
    </div>
  );
};

export default ReferralEnterForm;
