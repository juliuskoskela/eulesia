import { request, type FullConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const API_URL = process.env.PLAYWRIGHT_API_URL || "http://localhost:3001";
const AUTH_DIR = path.join(".artifacts", "playwright", ".auth");

const TEST_USER = {
  username: "e2e_testuser",
  password: "testpass123",
  name: "E2E Test User",
  inviteCode: process.env.E2E_INVITE_CODE || "E2ETEST",
};

const TEST_ADMIN = {
  username: "e2e_admin",
  password: "adminpass123",
};

async function waitForApi(timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ctx = await request.newContext({ baseURL: API_URL });
      const res = await ctx.get("/api/v1/health");
      if (res.ok()) {
        await ctx.dispose();
        return;
      }
      await ctx.dispose();
    } catch {
      // API not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `API did not become ready at ${API_URL} within ${timeoutMs}ms`,
  );
}

async function setupUserAuth(): Promise<void> {
  const ctx = await request.newContext({ baseURL: API_URL });

  // Try login first; register if it fails
  let res = await ctx.post("/api/v1/auth/login", {
    data: { username: TEST_USER.username, password: TEST_USER.password },
  });

  if (!res.ok()) {
    res = await ctx.post("/api/v1/auth/register", {
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password,
        name: TEST_USER.name,
        inviteCode: TEST_USER.inviteCode,
      },
    });
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`Failed to register test user: ${res.status()} ${body}`);
    }
  }

  // Persist cookies
  const storageState = await ctx.storageState();
  const userAuthPath = path.join(AUTH_DIR, "user.json");
  fs.writeFileSync(userAuthPath, JSON.stringify(storageState, null, 2));
  await ctx.dispose();
}

async function setupAdminAuth(): Promise<void> {
  const ctx = await request.newContext({ baseURL: API_URL });

  const res = await ctx.post("/api/v1/admin/auth/login", {
    data: { username: TEST_ADMIN.username, password: TEST_ADMIN.password },
  });

  if (!res.ok()) {
    // Admin may not exist in a fresh DB — skip admin auth setup
    console.warn(
      `Admin login failed (${res.status()}), admin tests will be skipped`,
    );
    await ctx.dispose();
    return;
  }

  const storageState = await ctx.storageState();
  const adminAuthPath = path.join(AUTH_DIR, "admin.json");
  fs.writeFileSync(adminAuthPath, JSON.stringify(storageState, null, 2));
  await ctx.dispose();
}

async function globalSetup(_config: FullConfig): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  await waitForApi();
  await setupUserAuth();
  await setupAdminAuth();
}

export default globalSetup;
