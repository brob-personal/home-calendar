import { defineConfig, mergeConfig } from "vite";
import viteConfig from "./vite.config.js";

// Vitest resolves a single config file and prefers vitest.config.* over
// vite.config.*, so the base config is merged in explicitly rather than picked
// up automatically. Without this the React plugin would be missing and every
// .jsx import would fail to transform.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.js"],
      css: false,
      include: ["src/**/*.{test,spec}.{js,jsx}"],
      restoreMocks: true,

      // The board is a long-running appliance; a hung test should fail loudly
      // rather than stall CI.
      testTimeout: 10_000,

      coverage: {
        provider: "v8",
        reportsOnly: false,
        reporter: ["text", "html"],
        // R13 owns the real thresholds. src/lib and src/contracts are the
        // targets named in the plan; both arrive with R2/R3.
        include: ["src/**/*.{js,jsx}"],
        exclude: ["src/test/**", "src/**/*.{test,spec}.{js,jsx}", "src/main.jsx"],
      },
    },
  }),
);
