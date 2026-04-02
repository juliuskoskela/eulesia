import { test, expect } from "./fixtures/auth";

test.describe("Admin", () => {
  test("admin login page renders", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator("#username")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("admin dashboard loads when authenticated", async ({
    adminPage: page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/admin/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin settings page accessible", async ({ adminPage: page }) => {
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/admin\/settings/);
  });
});
