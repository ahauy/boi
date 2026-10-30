import { useState } from "react";
import { Formik, Form, FormikHelpers } from "formik";
import { changePasswordSchema } from "@palmsight/shared";
import * as yup from "yup";
import FormikField from "@/components/customFieldsFormik/FormikField";
import InputField from "@/components/customFieldsFormik/InputField";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import useChangePasswordMutation from "../hooks/useChangePasswordMutation";
import type { ChangePasswordFormValues } from "../types";
import type { ApiErrorPayload } from "@/services/authService";

export const changePasswordValidationSchema = changePasswordSchema.shape({
  confirmPassword: yup
    .string()
    .required("Vui lòng xác nhận lại mật khẩu")
    .oneOf([yup.ref("newPassword")], "Mật khẩu xác nhận không khớp"),
});

export const ChangePasswordForm = () => {
  const { toast } = useToast();
  const [success, setSuccess] = useState<boolean>(false);
  const changePasswordMutation = useChangePasswordMutation();

  const initialValues: ChangePasswordFormValues = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  };

  const onSubmit = async (
    values: ChangePasswordFormValues,
    { setSubmitting, resetForm, setErrors }: FormikHelpers<ChangePasswordFormValues>
  ) => {
    setSuccess(false);
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setSuccess(true);
      resetForm();
      toast({
        description: "Đổi mật khẩu thành công.",
      });
    } catch (error: any) {
      const apiError = error?.response?.data?.error as ApiErrorPayload | undefined;

      if (apiError?.code === "CURRENT_PASSWORD_INCORRECT") {
        setErrors({ currentPassword: "Mật khẩu hiện tại không đúng" });
      } else if (apiError?.code === "VALIDATION_ERROR" && apiError.details?.fields?.length) {
        setErrors(
          Object.fromEntries(apiError.details.fields.map((f) => [f.field, f.message]))
        );
      } else {
        toast({
          variant: "destructive",
          description:
            apiError?.message ||
            error?.message ||
            "Không thể đổi mật khẩu lúc này. Vui lòng thử lại sau.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={changePasswordValidationSchema}
      onSubmit={onSubmit}
    >
      {({ isSubmitting }) => (
        <Form className="relative flex max-w-lg flex-col gap-4 mystic-card rounded-2xl p-6 sm:p-8 overflow-hidden">
          <TarotCorners />
          {success && (
            <div className="p-3.5 bg-terminal-success/10 border border-terminal-success/40 rounded-xl text-sm text-ink flex items-center gap-2">
              <span className="font-bold text-terminal-success">[✓]</span>
              <span>Đổi mật khẩu thành công.</span>
            </div>
          )}

          <FormikField
            component={InputField}
            name="currentPassword"
            type="password"
            label="Mật khẩu hiện tại"
            required
            placeholder="Nhập mật khẩu hiện tại"
            disabled={isSubmitting}
          />

          <FormikField
            component={InputField}
            name="newPassword"
            type="password"
            label="Mật khẩu mới"
            required
            placeholder="Tối thiểu 8 ký tự"
            disabled={isSubmitting}
          />

          <FormikField
            component={InputField}
            name="confirmPassword"
            type="password"
            label="Xác nhận mật khẩu"
            required
            placeholder="Nhập lại mật khẩu mới"
            disabled={isSubmitting}
          />

          <Button type="submit" isLoading={isSubmitting} className="mt-2 h-11">
            Đổi mật khẩu
          </Button>
        </Form>
      )}
    </Formik>
  );
};

export default ChangePasswordForm;
