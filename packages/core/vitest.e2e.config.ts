/// <reference types="vitest" />
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    include: ["src/__tests__/e2e/**/*.e2e.ts"],
    testTimeout: 120000,
    hookTimeout: 60000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    setupFiles: ["src/__tests__/e2e/setup/test-environment.ts"],
    reporters: ["default", "json"],
    outputFile: { json: "test-results/e2e-results.json" },
  },
});
