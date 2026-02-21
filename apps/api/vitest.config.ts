import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,mts}"],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      exclude: ["node_modules/", "**/*.d.ts"],
    },
  },
});
