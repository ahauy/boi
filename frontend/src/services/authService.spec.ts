import { describe, it, expect, vi, beforeEach } from "vitest";
import authService from "./authService";
import httpService from "./httpService";
import { AUTH_REGISTER_URL, AUTH_VERIFY_EMAIL_URL } from "@/consts/apiUrl";

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("postRegister", () => {
    it("should send claimToken when provided", async () => {
      const mockResponse = { data: { email: "test@example.com", verificationExpiresAt: "2026-10-20" } };
      const postSpy = vi.spyOn(httpService, "post").mockResolvedValueOnce(mockResponse as any);

      const payload = {
        displayName: "Tester",
        username: "tester",
        email: "test@example.com",
        password: "Password123!",
        claimToken: "550e8400-e29b-41d4-a716-446655440000",
      };

      const result = await authService.postRegister(payload);

      expect(postSpy).toHaveBeenCalledWith(AUTH_REGISTER_URL, payload);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("postVerifyEmail", () => {
    it("should send claimToken when provided", async () => {
      const mockResponse = {
        data: {
          accessToken: "jwt-token",
          expiresIn: 900,
          isNewUser: true,
          user: { id: "user-1", creditBalance: 2 },
          claimedReadingId: "reading-123",
        },
      };
      const postSpy = vi.spyOn(httpService, "post").mockResolvedValueOnce(mockResponse as any);

      const payload = {
        token: "verify-token-xyz",
        claimToken: "550e8400-e29b-41d4-a716-446655440000",
      };

      const result = await authService.postVerifyEmail(payload);

      expect(postSpy).toHaveBeenCalledWith(AUTH_VERIFY_EMAIL_URL, payload);
      expect(result).toEqual(mockResponse.data);
      expect(result.claimedReadingId).toBe("reading-123");
    });
  });
});
