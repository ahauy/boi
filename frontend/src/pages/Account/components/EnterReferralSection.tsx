import { useState } from "react";
import { Formik, Form } from "formik";
import { enterReferralSchema } from "@palmsight/shared";
import { useAuth } from "@/providers/AuthenticationProvider";
import { useQueryClient } from "@tanstack/react-query";
import { ME_QUERY_KEY } from "../hooks/useMeQuery";
import accountService from "../services";
import type { UserDto } from "../types";
import type { ApiErrorPayload } from "@/services/authService";

const ERROR_MESSAGE_MAP: Record<string, string> = {
  REFERRAL_SELF: "Bạn không thể nhập mã của chính mình",
  REFERRAL_CODE_NOT_FOUND: "Mã không tồn tại, kiểm tra lại",
  REFERRAL_ALREADY_USED: "Tài khoản đã nhập mã giới thiệu trước đó",
  REFERRAL_CYCLE: "Không thể nhập mã của người bạn đã mời",
  REFERRAL_NOT_ALLOWED: "Tài khoản không đủ điều kiện nhập mã",
};

interface EnterReferralSectionProps {
  user: UserDto | null;
}

export const EnterReferralSection = ({ user }: EnterReferralSectionProps) => {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const canEnter = user?.referral?.canEnterCode === true;
  const currentEnteredCode = user?.referral?.enteredCode || submittedCode;

  const handleSubmit = async (
    values: { code: string },
    { setSubmitting, setFieldError, resetForm }: any
  ) => {
    setGeneralError(null);
    try {
      const trimmedCode = values.code.trim().toUpperCase();
      const response = await accountService.enterReferral(trimmedCode);

      if (typeof response.creditBalance === "number") {
        updateUser({
          creditBalance: response.creditBalance,
          referral: {
            canEnterCode: false,
            enteredCode: trimmedCode,
          },
        });
      }

      setSubmittedCode(trimmedCode);
      const referrerName = response.referrer?.displayName || "bạn bè";
      setSuccessMessage(
        `[✓] Đã ghi nhận mã của ${referrerName}! Bạn được cộng 1 credit.`
      );

      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      resetForm();
    } catch (err: any) {
      const response = err?.response;
      const apiError = (response?.data?.error || response?.data || {}) as ApiErrorPayload;
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
    <section id="nhap-ma" className="mt-16 scroll-mt-32 md:scroll-mt-24 font-sans text-ink">
      <div className="pb-3 border-b border-gold/25 flex items-center gap-2">
        <span className="text-gold text-sm">✦</span>
        <h2 className="text-2xl font-display font-bold text-gold-gradient">Nhập mã giới thiệu</h2>
      </div>

      <div className="mt-6">
        {successMessage && (
          <div
            role="status"
            className="p-3.5 mb-4 text-sm border border-terminal-success/40 bg-terminal-success/10 text-ink rounded-xl"
          >
            {successMessage}
          </div>
        )}

        {currentEnteredCode ? (
          <div
            data-testid="entered-code-display"
            className="p-4 mystic-card rounded-xl text-sm text-gold-light font-mono font-medium"
          >
            [✓] Đã nhập mã giới thiệu: {currentEnteredCode}
          </div>
        ) : canEnter ? (
          <Formik
            initialValues={{ code: "" }}
            validationSchema={enterReferralSchema}
            onSubmit={handleSubmit}
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
                className="w-full max-w-[500px] mystic-card rounded-xl p-5 flex flex-col"
                noValidate
                data-testid="enter-referral-form"
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
                  htmlFor="referral-code-input"
                  className="text-xs font-mono uppercase tracking-wider font-bold text-gold-light mb-2 block cursor-pointer"
                >
                  Mã giới thiệu từ bạn bè
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    id="referral-code-input"
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
                    className="flex-1 h-10 px-3.5 bg-surface-soft/80 text-gold-light border border-gold/30 rounded-lg text-base font-mono tracking-[3px] uppercase outline-none focus:border-gold"
                    aria-invalid={Boolean(touched.code && errors.code)}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary h-10 px-5 text-sm cursor-pointer select-none disabled:opacity-50 shrink-0"
                  >
                    {isSubmitting ? "Đang xử lý..." : "Xác nhận mã"}
                  </button>
                </div>

                {touched.code && errors.code ? (
                  <div className="text-xs text-terminal-danger mt-2">
                    {errors.code}
                  </div>
                ) : (
                  <div className="mt-2.5 text-xs text-mute">
                    [i] Mã gồm 8 ký tự in hoa. Nhập mã để nhận ngay 1 credit.
                  </div>
                )}
              </Form>
            )}
          </Formik>
        ) : (
          <div
            data-testid="referral-not-eligible"
            className="p-4 mystic-card rounded-xl text-sm text-mute"
          >
            Tài khoản không đủ điều kiện nhập mã.
          </div>
        )}
      </div>
    </section>
  );
};

export default EnterReferralSection;
