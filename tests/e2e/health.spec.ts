import { test, expect } from "@playwright/test";

const API_URL = process.env.PLAYWRIGHT_API_URL || "http://localhost:3001";

test.describe("API Health", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/health`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe("ok");
  });
});
