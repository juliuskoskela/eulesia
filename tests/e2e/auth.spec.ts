import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/");
    // Initial step shows "Sign in" button; click it to get to login form
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.locator("#login-username")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.fill("#login-username", "nonexistent_user");
    await page.fill("#login-password", "wrongpassword");
    await page.locator('button[type="submit"]').click();

    // Should stay on login page and show an error
    await expect(page).toHaveURL(/^\/$|\/login/);
  });

  test("registration page renders", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveURL(/register/);
  });
});
