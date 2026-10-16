import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const alias = {
  "@": r("./src"),
  "server-only": r("./tests/stubs/empty.ts"),
  "next/cache": r("./tests/stubs/next-cache.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] } },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          // Integration tests only ever touch the dedicated test database.
          env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
          fileParallelism: false,
          testTimeout: 20000,
        },
      },
    ],
  },
});
