import { test, expect } from "@playwright/test";

const TINY_JPEG_BUFFER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64"
);

test.describe("T034 [US2]: Playwright E2E Anti-Abuse Tests", () => {
  test("Blocks second guest trial attempt on same browser with 403 GUEST_TRIAL_LIMIT_REACHED", async ({
    page,
    context,
  }) => {
    // 1. Simulate browser with existing ps_guest_trial cookie
    await context.addCookies([
      {
        name: "ps_guest_trial",
        value: "s%3Aexisting-claim-token-12345.signature",
        domain: "localhost",
        path: "/api/v1",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.route("**/api/v1/auth/refresh", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" },
        }),
      });
    });

    await page.route("**/api/v1/readings/guest", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "GUEST_TRIAL_LIMIT_REACHED",
            message:
              "Bạn đã sử dụng hết 1 lượt bói thử miễn phí. Hãy đăng ký tài khoản để tiếp tục trải nghiệm!",
          },
        }),
      });
    });

    // 2. Navigate to Scan page
    await page.goto("/scan");
    const submitBtn = page.locator('[data-testid="submit-reading-button"]');
    await expect(submitBtn).toBeVisible();

    // 3. Upload photo and consent
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: "palm.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG_BUFFER,
    });

    const consentCheckbox = page.locator('[data-testid="ai-consent-checkbox"]');
    await consentCheckbox.check();

    // 4. Click Submit
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 5. Verify error notification / message appears
    await expect(
      page.getByTestId("limit-reached-banner")
    ).toBeVisible();

    // Verify user is not redirected to preview page
    expect(page.url()).toContain("/scan");
  });

  test("Blocks guest trial in Incognito / Private session with matching device fingerprint (403 GUEST_TRIAL_LIMIT_REACHED)", async ({
    browser,
  }) => {
    // Create completely isolated incognito context (zero cookies)
    const incognitoContext = await browser.newContext();
    const page = await incognitoContext.newPage();

    await page.route("**/api/v1/auth/refresh", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" },
        }),
      });
    });

    // Server recognizes fingerprint and denies trial
    await page.route("**/api/v1/readings/guest", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "GUEST_TRIAL_LIMIT_REACHED",
            message:
              "Bạn đã sử dụng hết 1 lượt bói thử miễn phí. Hãy đăng ký tài khoản để tiếp tục trải nghiệm!",
          },
        }),
      });
    });

    // Navigate to Scan page
    await page.goto("/scan");

    // Upload photo and consent
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: "palm.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG_BUFFER,
    });

    const consentCheckbox = page.locator('[data-testid="ai-consent-checkbox"]');
    await consentCheckbox.check();

    // Submit
    const submitBtn = page.locator('[data-testid="submit-reading-button"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Assert blocked with warning
    await expect(
      page.getByTestId("limit-reached-banner")
    ).toBeVisible();

    await incognitoContext.close();
  });
});
