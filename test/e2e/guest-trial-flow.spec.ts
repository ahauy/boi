import { test, expect } from "@playwright/test";

const TINY_JPEG_BUFFER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64"
);

const MOCK_CLAIM_TOKEN = "e4b8a21f-82df-4db3-9824-7128cf4291f0";
const MOCK_READING_ID = "67139f7e-c885-4463-a62a-3a5e1fb83001";
const MOCK_VALID_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzEzOWY3ZS1jODg1LTQ0NjMtYTYyYS0zYTVlMWZiODMwOTkiLCJlbWFpbCI6InR1YW5oYXVAZXhhbXBsZS5jb20ifQ.mock_sig";

test.describe("T033 [US1]: Playwright E2E Happy Path Flow", () => {
  test("Landing Page -> Guest Scan -> 50% Teaser Preview -> Register with claimToken -> Verify Email -> Auto-redirect to Full 100% Reading with 2 credits", async ({
    page,
    context,
  }) => {
    let isUserAuthenticated = false;

    // 1. Mock API endpoints
    await page.route("**/api/v1/auth/refresh", async (route) => {
      if (!isUserAuthenticated) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            accessToken: MOCK_VALID_JWT,
            expiresIn: 900,
          }),
        });
      }
    });

    await page.route("**/api/v1/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "67139f7e-c885-4463-a62a-3a5e1fb83099",
          displayName: "Tuấn Hậu",
          username: "tuanhau",
          email: "tuanhau@example.com",
          avatarUrl: null,
          creditBalance: 2,
          referralCode: "PALM2026",
          referralLink: "http://localhost:5173/r/PALM2026",
          hasPassword: true,
          providers: [],
          referral: {
            canEnterCode: false,
            enteredCode: null,
          },
        }),
      });
    });

    await page.route("**/api/v1/readings/guest", async (route) => {
      await context.addCookies([
        {
          name: "ps_guest_trial",
          value: "s%3A" + MOCK_CLAIM_TOKEN + ".signed_cookie_sig",
          domain: "localhost",
          path: "/api/v1",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          reading: {
            id: MOCK_READING_ID,
            school: "WESTERN",
            hand: "LEFT",
            topics: ["lifeLine", "headLine", "heartLine", "career", "love"],
            status: "GUEST_PREVIEW",
            summary:
              "Bàn tay của bạn mang năng lượng Thổ với đường sinh đạo sâu và rõ nét...",
            sections: [
              {
                key: "lifeLine",
                title: "Đường Sinh Đạo (Life Line)",
                observation: "Đường cong sâu, rõ, không đứt đoạn.",
                meaning: "Bạn có thể chất dẻo dai và năng lượng dồi dào.",
                isLocked: false,
              },
              {
                key: "headLine",
                title: "Đường Trí Đạo (Head Line)",
                observation: "Đường trí đạo thẳng và dài.",
                meaning: "Tư duy logic, thực tế.",
                isLocked: false,
              },
              {
                key: "heartLine",
                title: "Đường Tâm Đạo (Heart Line)",
                observation: null,
                meaning: null,
                isLocked: true,
              },
            ],
            aspects: {
              career: {
                title: "Sự nghiệp & Công danh",
                content: null,
                isLocked: true,
              },
              love: {
                title: "Tình duyên & Mối quan hệ",
                content: null,
                isLocked: true,
              },
            },
            advice: {
              content: null,
              isLocked: true,
            },
            disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
            previewExpiresAt: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            createdAt: new Date().toISOString(),
            claimToken: MOCK_CLAIM_TOKEN,
          },
          claimToken: MOCK_CLAIM_TOKEN,
        }),
      });
    });

    await page.route(`**/api/v1/readings/guest/${MOCK_CLAIM_TOKEN}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: MOCK_READING_ID,
          school: "WESTERN",
          hand: "LEFT",
          topics: ["lifeLine", "headLine", "heartLine", "career", "love"],
          status: "GUEST_PREVIEW",
          summary:
            "Bàn tay của bạn mang năng lượng Thổ với đường sinh đạo sâu và rõ nét...",
          sections: [
            {
              key: "lifeLine",
              title: "Đường Sinh Đạo (Life Line)",
              observation: "Đường cong sâu, rõ, không đứt đoạn.",
              meaning: "Bạn có thể chất dẻo dai và năng lượng dồi dào.",
              isLocked: false,
            },
            {
              key: "headLine",
              title: "Đường Trí Đạo (Head Line)",
              observation: "Đường trí đạo thẳng và dài.",
              meaning: "Tư duy logic, thực tế.",
              isLocked: false,
            },
            {
              key: "heartLine",
              title: "Đường Tâm Đạo (Heart Line)",
              observation: null,
              meaning: null,
              isLocked: true,
            },
          ],
          aspects: {
            career: {
              title: "Sự nghiệp & Công danh",
              content: null,
              isLocked: true,
            },
            love: {
              title: "Tình duyên & Mối quan hệ",
              content: null,
              isLocked: true,
            },
          },
          advice: {
            content: null,
            isLocked: true,
          },
          disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
          previewExpiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          createdAt: new Date().toISOString(),
          claimToken: MOCK_CLAIM_TOKEN,
        }),
      });
    });

    let capturedRegisterBody: any = null;
    await page.route("**/api/v1/auth/register", async (route) => {
      capturedRegisterBody = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          email: capturedRegisterBody.email,
          verificationExpiresAt: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(),
        }),
      });
    });

    let capturedVerifyBody: any = null;
    await page.route("**/api/v1/auth/verify-email", async (route) => {
      capturedVerifyBody = JSON.parse(route.request().postData() || "{}");
      isUserAuthenticated = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: MOCK_VALID_JWT,
          expiresIn: 900,
          isNewUser: true,
          user: {
            id: "67139f7e-c885-4463-a62a-3a5e1fb83099",
            displayName: "Tuấn Hậu",
            username: "tuanhau",
            avatarUrl: null,
            creditBalance: 2,
            referralCode: "PALM2026",
          },
          claimedReadingId: MOCK_READING_ID,
        }),
      });
    });

    await page.route(`**/api/v1/readings/${MOCK_READING_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: MOCK_READING_ID,
          school: "WESTERN",
          hand: "LEFT",
          topics: ["lifeLine", "headLine", "heartLine", "career", "love"],
          status: "DONE",
          result: {
            isPalm: true,
            school: "WESTERN",
            hand: "LEFT",
            topics: ["lifeLine", "headLine", "heartLine", "career", "love"],
            summary: "Bàn tay mang năng lượng Thổ với đường sinh đạo sâu và rõ nét...",
            sections: [
              {
                key: "lifeLine",
                title: "Đường Sinh Đạo (Life Line)",
                observation: "Đường cong sâu, rõ, không đứt đoạn.",
                meaning: "Bạn có thể chất dẻo dai và năng lượng dồi dào.",
              },
              {
                key: "headLine",
                title: "Đường Trí Đạo (Head Line)",
                observation: "Đường trí đạo thẳng và dài.",
                meaning: "Tư duy logic, thực tế.",
              },
              {
                key: "heartLine",
                title: "Đường Tâm Đạo (Heart Line)",
                observation: "Đường tâm đạo sâu, kéo dài.",
                meaning: "Tình cảm sâu sắc, chung thủy.",
              },
            ],
            aspects: {
              career: "Sự nghiệp thăng tiến vững chắc.",
              love: "Tình duyên viên mãn.",
            },
            advice: "Tập trung vào thế mạnh chuyên môn.",
            disclaimer: "Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.",
          },
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        }),
      });
    });

    // 2. Step 1: Start at Homepage and click Guest Trial CTA
    await page.goto("/");
    const guestCta = page.locator('[data-testid="hero-guest-trial-cta"]');
    await expect(guestCta).toBeVisible();
    await guestCta.click();

    // 3. Step 2: Guest Scan page
    await expect(page).toHaveURL(/\/scan/);
    const submitBtn = page.locator('[data-testid="submit-reading-button"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText("Bói thử miễn phí");

    // Upload photo and consent
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: "palm.jpg",
      mimeType: "image/jpeg",
      buffer: TINY_JPEG_BUFFER,
    });

    const consentCheckbox = page.locator('[data-testid="ai-consent-checkbox"]');
    await consentCheckbox.check();

    // Submit reading
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 4. Step 3: 50% Teaser Preview page
    await expect(page).toHaveURL(new RegExp(`/guest/reading/${MOCK_CLAIM_TOKEN}`));
    await expect(page.locator('[data-testid="preview-summary-card"]')).toBeVisible();

    // Verify unlocked sections and locked sections
    const lockedBadges = page.locator('[data-testid="locked-badge"]');
    await expect(lockedBadges.first()).toBeVisible();
    await expect(lockedBadges.first()).toContainText("NỘI DUNG ĐÃ KHÓA");

    // Click Unlock Now button
    const unlockBtn = page.locator('[data-testid="unlock-now-button"]');
    await expect(unlockBtn).toBeVisible();
    await unlockBtn.click();

    // 5. Step 4: Register page carrying claimToken
    await expect(page).toHaveURL(new RegExp(`/register.*claimToken=${MOCK_CLAIM_TOKEN}`));
    await expect(page.locator('[data-testid="claim-token-banner"]')).toBeVisible();

    // Fill in registration fields
    await page.locator('input[name="displayName"]').fill("Tuấn Hậu");
    await page.locator('input[name="username"]').fill("tuanhau");
    await page.locator('input[name="email"]').fill("tuanhau@example.com");
    await page.locator('input[name="password"]').fill("StrongPassword123!");
    await page.locator('input[name="confirmPassword"]').fill("StrongPassword123!");
    await page.locator('input[name="termsAccepted"]').check({ force: true });

    // Submit registration
    await page.locator('button[type="submit"]').click();

    // Verify payload captured by register route includes claimToken
    await expect.poll(() => capturedRegisterBody?.claimToken).toBe(MOCK_CLAIM_TOKEN);

    // 6. Step 5: Check-email screen is shown
    await expect(page).toHaveURL(/\/register\/check-email/);

    // 7. Step 6: User clicks verification link in email -> /verify-email?token=...&claimToken=...
    await page.goto(
      `/verify-email?token=fake_raw_verification_token_123&claimToken=${MOCK_CLAIM_TOKEN}`
    );

    // Verify payload captured by verifyEmail includes claimToken
    await expect.poll(() => capturedVerifyBody?.claimToken).toBe(MOCK_CLAIM_TOKEN);

    // 8. Step 7: Verify success view displays celebration banner and wallet balance = 2 credits
    const celebration = page.locator('[data-testid="claim-success-celebration"]');
    await expect(celebration).toBeVisible();
    await expect(celebration).toContainText("2 credits");
    await expect(celebration).toContainText("Đã mở khóa 100% bài bói");

    // Click 'Bỏ qua chờ đợi' to navigate immediately to full reading
    await page.getByRole("button", { name: "Bỏ qua chờ đợi" }).click();

    // 9. Step 8: Auto-navigates to Full 100% Reading screen (/readings/:id)
    await expect(page).toHaveURL(new RegExp(`/readings/${MOCK_READING_ID}`));
    await expect(page.getByText("Đường Tâm Đạo (Heart Line)")).toBeVisible();
    await expect(page.getByText("Tình cảm sâu sắc, chung thủy.")).toBeVisible();
  });
});
