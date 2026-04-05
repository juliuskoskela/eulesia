import { test as base, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const AUTH_DIR = path.join(".artifacts", "playwright", ".auth");

/** Create an authenticated page from stored auth state, fail on pageerror. */
async function authedPage(
  browser: import("@playwright/test").Browser,
  authFile: string,
): Promise<{ page: Page; context: import("@playwright/test").BrowserContext }> {
  if (!fs.existsSync(authFile)) {
    throw new Error(
      `Auth state not found at ${authFile}. Did global setup run?`,
    );
  }
  const context = await browser.newContext({ storageState: authFile });
  const page = await context.newPage();

  // Collect page errors — tests assert on these
  const errors: Error[] = [];
  page.on("pageerror", (error) => {
    // Ignore Socket.IO errors (expected until frontend switches to WS v2)
    if (error.message.includes("socket.io")) return;
    errors.push(error);
    console.error(`[Page Error] ${error.message}`);
  });
  (page as unknown as Record<string, unknown>).__pageErrors = errors;

  return { page, context };
}

export const test = base.extend<{
  authenticatedPage: Page;
  secondUserPage: Page;
  adminPage: Page;
}>({
  authenticatedPage: async ({ browser }, use) => {
    const { page, context } = await authedPage(
      browser,
      path.join(AUTH_DIR, "user.json"),
    );
    await use(page);
    await context.close();
  },

  secondUserPage: async ({ browser }, use) => {
    const { page, context } = await authedPage(
      browser,
      path.join(AUTH_DIR, "user2.json"),
    );
    await use(page);
    await context.close();
  },

  adminPage: async ({ browser }, use, testInfo) => {
    const authFile = path.join(AUTH_DIR, "admin.json");
    if (!fs.existsSync(authFile)) {
      testInfo.skip(true, "Admin auth state not available");
      return;
    }
    const { page, context } = await authedPage(browser, authFile);
    await use(page);
    await context.close();
  },
});

/** Assert no uncaught page errors were recorded during the test. */
export function expectNoPageErrors(page: Page) {
  const errors = (page as unknown as Record<string, unknown>).__pageErrors as
    | Error[]
    | undefined;
  if (errors && errors.length > 0) {
    throw new Error(
      `Page had ${errors.length} uncaught error(s):\n${errors.map((e) => e.message).join("\n")}`,
    );
  }
}

export { expect } from "@playwright/test";
