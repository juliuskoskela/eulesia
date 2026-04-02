import { test, expect } from "./fixtures/auth";

test.describe("Navigation", () => {
  test("public routes are reachable", async ({ page }) => {
    for (const route of ["/agora", "/about", "/terms", "/privacy"]) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("protected routes redirect unauthenticated users", async ({ page }) => {
    await page.goto("/profile");
    // Should redirect to login
    await expect(page).toHaveURL(/^\/$|\/login/);
  });

  test("authenticated user can reach protected routes", async ({
    authenticatedPage: page,
  }) => {
    for (const route of ["/agora", "/profile"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
    }
  });
});
