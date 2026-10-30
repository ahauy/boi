import { describe, it, expect } from "vitest";
import { getFingerprint } from "./fingerprint";

describe("fingerprint helper", () => {
  it("should return a 64-character lowercase hexadecimal hash", async () => {
    const fp = await getFingerprint();
    expect(fp).toBeDefined();
    expect(typeof fp).toBe("string");
    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should be consistent across multiple invocations on same device", async () => {
    const fp1 = await getFingerprint();
    const fp2 = await getFingerprint();
    expect(fp1).toBe(fp2);
  });
});
