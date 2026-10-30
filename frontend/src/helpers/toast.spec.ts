import { describe, it, expect, vi, beforeEach } from "vitest";
import * as useToastModule from "@/components/ui/use-toast";
import { showSuccess, showError, extractErrorMessage } from "./toast";

describe("toast helper (PalmSight UI Toast integration)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractErrorMessage", () => {
    it("should return string message as-is", () => {
      expect(extractErrorMessage("Lỗi kiểm tra")).toBe("Lỗi kiểm tra");
    });

    it("should extract message from response.data.error.message (PalmSight API format)", () => {
      const err = {
        response: {
          data: {
            error: {
              code: "EMAIL_TAKEN",
              message: "Email này đã được sử dụng.",
            },
          },
        },
      };
      expect(extractErrorMessage(err)).toBe("Email này đã được sử dụng.");
    });

    it("should extract message from response.data.message (standard NestJS format)", () => {
      const err = {
        response: {
          data: {
            message: "Unauthorized access",
          },
        },
      };
      expect(extractErrorMessage(err)).toBe("Unauthorized access");
    });

    it("should extract stringified errors from response.data.errors", () => {
      const err = {
        response: {
          data: {
            errors: { email: ["Invalid email"] },
          },
        },
      };
      expect(extractErrorMessage(err)).toBe(JSON.stringify({ email: ["Invalid email"] }));
    });

    it("should extract title from response.data.title", () => {
      const err = {
        response: {
          data: {
            title: "Validation Error",
          },
        },
      };
      expect(extractErrorMessage(err)).toBe("Validation Error");
    });

    it("should extract message from error.message (standard Error object)", () => {
      const err = new Error("Connection timed out");
      expect(extractErrorMessage(err)).toBe("Connection timed out");
    });

    it("should fallback to default error message when no error details are present", () => {
      expect(extractErrorMessage({})).toBe("Có lỗi xảy ra. Vui lòng thử lại.");
      expect(extractErrorMessage(null)).toBe("Có lỗi xảy ra. Vui lòng thử lại.");
      expect(extractErrorMessage(undefined)).toBe("Có lỗi xảy ra. Vui lòng thử lại.");
    });
  });

  describe("showSuccess", () => {
    it("should call toast with description and undefined title when not provided", () => {
      const toastSpy = vi.spyOn(useToastModule, "toast").mockReturnValue({
        id: "test-id",
        dismiss: vi.fn(),
        update: vi.fn(),
      });

      showSuccess("Thao tác thành công");
      expect(toastSpy).toHaveBeenCalledWith({
        title: undefined,
        description: "Thao tác thành công",
        action: undefined,
      });
    });

    it("should call toast with title and description when options.title is provided", () => {
      const toastSpy = vi.spyOn(useToastModule, "toast").mockReturnValue({
        id: "test-id",
        dismiss: vi.fn(),
        update: vi.fn(),
      });

      showSuccess("Thao tác thành công", { title: "Thông báo" });
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Thông báo",
        description: "Thao tác thành công",
        action: undefined,
      });
    });

    it("should convert non-string message to string", () => {
      const toastSpy = vi.spyOn(useToastModule, "toast").mockReturnValue({
        id: "test-id",
        dismiss: vi.fn(),
        update: vi.fn(),
      });

      showSuccess(12345);
      expect(toastSpy).toHaveBeenCalledWith({
        title: undefined,
        description: "12345",
        action: undefined,
      });
    });
  });

  describe("showError", () => {
    it("should call destructive toast with extracted error message", () => {
      const toastSpy = vi.spyOn(useToastModule, "toast").mockReturnValue({
        id: "test-id",
        dismiss: vi.fn(),
        update: vi.fn(),
      });

      showError("Tài khoản không tồn tại");
      expect(toastSpy).toHaveBeenCalledWith({
        variant: "destructive",
        title: undefined,
        description: "Tài khoản không tồn tại",
        action: undefined,
      });
    });

    it("should call destructive toast with extracted API response error message and title", () => {
      const toastSpy = vi.spyOn(useToastModule, "toast").mockReturnValue({
        id: "test-id",
        dismiss: vi.fn(),
        update: vi.fn(),
      });

      const apiErr = {
        response: {
          data: {
            error: {
              code: "EMAIL_TAKEN",
              message: "Email này đã được sử dụng.",
            },
          },
        },
      };

      showError(apiErr, { title: "Đăng ký thất bại" });
      expect(toastSpy).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Đăng ký thất bại",
        description: "Email này đã được sử dụng.",
        action: undefined,
      });
    });
  });
});
