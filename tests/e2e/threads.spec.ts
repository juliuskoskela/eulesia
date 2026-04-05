import { test, expect, expectNoPageErrors } from "./fixtures/auth";

const API_URL = process.env.PLAYWRIGHT_API_URL || "http://localhost:3001";

test.describe("Thread CRUD", () => {
  test("user can create a thread and see it on the detail page", async ({
    authenticatedPage: page,
  }) => {
    const ctx = await page.context();
    const title = `E2E Thread ${Date.now()}`;

    // Create thread via API
    const res = await ctx.request.post(`${API_URL}/api/v1/agora/threads`, {
      data: {
        title,
        content: "This is an e2e test thread.",
        scope: "national",
      },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const threadId = data.data?.id;
    expect(threadId).toBeTruthy();

    // Navigate to thread detail
    await page.goto(`/agora/thread/${threadId}`);
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    expectNoPageErrors(page);
  });

  test("user can add a comment to a thread", async ({
    authenticatedPage: page,
  }) => {
    const ctx = await page.context();
    const title = `E2E Comment Thread ${Date.now()}`;

    // Create thread
    const threadRes = await ctx.request.post(
      `${API_URL}/api/v1/agora/threads`,
      {
        data: {
          title,
          content: "Thread for comment test.",
          scope: "national",
        },
      },
    );
    expect(threadRes.ok()).toBeTruthy();
    const threadData = await threadRes.json();
    const threadId = threadData.data?.id;

    // Add comment via API
    const commentRes = await ctx.request.post(
      `${API_URL}/api/v1/agora/threads/${threadId}/comments`,
      { data: { content: "E2E test comment" } },
    );
    expect(commentRes.ok()).toBeTruthy();

    // Navigate to thread and verify comment renders
    await page.goto(`/agora/thread/${threadId}`);
    await expect(page.getByText("E2E test comment")).toBeVisible({
      timeout: 10000,
    });

    expectNoPageErrors(page);
  });

  test("agora feed loads threads without page errors", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/agora");
    await expect(page.locator("main")).toBeVisible();

    // Wait for threads to load (at least one thread card should appear)
    await page.waitForTimeout(2000);

    expectNoPageErrors(page);
  });
});
