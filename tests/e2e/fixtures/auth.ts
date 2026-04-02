import { test as base, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const AUTH_DIR = path.join(".artifacts", "playwright", ".auth");

export const test = base.extend<{
  authenticatedPage: Page;
  adminPage: Page;
}>({
  authenticatedPage: async ({ browser }, use) => {
    const authFile = path.join(AUTH_DIR, "user.json");
    if (!fs.existsSync(authFile)) {
      throw new Error(
        `User auth state not found at ${authFile}. Did global setup run?`,
      );
    }
    const context = await browser.newContext({
      storageState: authFile,
    });
    const page = await context.newPage();

    // Monitor for runtime errors
    page.on("pageerror", (error) => {
      console.error(`[Page Error] ${error.message}`);
    });

    await use(page);
    await context.close();
  },

  adminPage: async ({ browser }, use, testInfo) => {
    const authFile = path.join(AUTH_DIR, "admin.json");
    if (!fs.existsSync(authFile)) {
      testInfo.skip(true, "Admin auth state not available");
      return;
    }
    const context = await browser.newContext({
      storageState: authFile,
    });
    const page = await context.newPage();

    page.on("pageerror", (error) => {
      console.error(`[Page Error] ${error.message}`);
    });

    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
