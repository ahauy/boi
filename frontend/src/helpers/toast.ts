import { toast } from "@/components/ui/use-toast";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

export interface ToastOptions {
  title?: string;
  action?: ToastActionElement;
}

export const extractErrorMessage = (error: any): string => {
  if (typeof error === "string") {
    return error;
  }

  if (error?.response?.data) {
    const data = error.response.data;
    if (data?.error?.message && typeof data.error.message === "string") {
      return data.error.message;
    }
    if (data?.message && typeof data.message === "string") {
      return data.message;
    }
    if (data?.errors) {
      return typeof data.errors === "string"
        ? data.errors
        : JSON.stringify(data.errors);
    }
    if (data?.title && typeof data.title === "string") {
      return data.title;
    }
  }

  if (error?.message && typeof error.message === "string") {
    return error.message;
  }

  if (error && typeof error.toString === "function") {
    const str = error.toString();
    if (str && str !== "[object Object]") {
      return str;
    }
  }

  return "Có lỗi xảy ra. Vui lòng thử lại.";
};

export const showSuccess = (
  msg: any,
  options?: { title?: string; action?: ToastActionElement }
): void => {
  const description = typeof msg === "string" ? msg : msg != null ? String(msg) : "";
  toast({
    title: options?.title,
    description,
    action: options?.action,
  });
};

export const showError = (
  error: any,
  options?: { title?: string; action?: ToastActionElement }
): void => {
  const extractedMessage = extractErrorMessage(error);
  toast({
    variant: "destructive",
    title: options?.title,
    description: extractedMessage,
    action: options?.action,
  });
};

export { toast, type ToastProps, type ToastActionElement };
