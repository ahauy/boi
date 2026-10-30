import { describe, it, expect, vi, beforeEach } from "vitest";
import readingsService from "./readingsService";
import httpService from "./httpService";
import { READINGS_GUEST_URL } from "@/consts/apiUrl";

describe("readingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGuestReading", () => {
    it("should post to READINGS_GUEST_URL with Idempotency-Key and withCredentials", async () => {
      const mockResponse = {
        data: {
          reading: { id: "reading-123", claimToken: "token-abc" },
          claimToken: "token-abc",
        },
      };
      const postSpy = vi
        .spyOn(httpService.axios, "post")
        .mockResolvedValueOnce(mockResponse as any);

      const formData = new FormData();
      formData.append("school", "EASTERN");
      const key = "550e8400-e29b-41d4-a716-446655440000";

      const result = await readingsService.createGuestReading(formData, key);

      expect(postSpy).toHaveBeenCalledWith(
        READINGS_GUEST_URL,
        formData,
        expect.objectContaining({
          headers: { "Idempotency-Key": key },
          withCredentials: true,
        })
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("getGuestReadingPreview", () => {
    it("should get from READINGS_GUEST_URL/:token with withCredentials", async () => {
      const mockResponse = {
        data: {
          id: "reading-123",
          summary: "Summary text",
          sections: [],
          claimToken: "test-token",
        },
      };
      const getSpy = vi
        .spyOn(httpService.axios, "get")
        .mockResolvedValueOnce(mockResponse as any);

      const result = await readingsService.getGuestReadingPreview("test-token");

      expect(getSpy).toHaveBeenCalledWith(`${READINGS_GUEST_URL}/test-token`, {
        withCredentials: true,
      });
      expect(result).toEqual(mockResponse.data);
    });
  });
});
