import { test, expect, expectNoPageErrors } from "./fixtures/auth";

test.describe("Agora", () => {
  test("agora page loads for authenticated user", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/agora");
    await expect(page).toHaveURL(/agora/);
    await expect(page.locator("main")).toBeVisible();
    expectNoPageErrors(page);
  });

  test("agora page is publicly accessible", async ({ page }) => {
    await page.goto("/agora");
    await expect(page).toHaveURL(/agora/);
    await expect(page.locator("main")).toBeVisible();
  });
});
