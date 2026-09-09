import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Kept as a plain object (not a function) so vitest.config.js can mergeConfig
// against it and inherit the React plugin without duplicating it.
export default defineConfig({
  plugins: [react()],

  server: {
    // host:true binds 0.0.0.0 so the iPad can load the dev server over the LAN
    // while you are still iterating — the board is never developed on-device.
    host: true,
    port: 5173,
  },

  preview: {
    host: true,
    port: 4173,
  },

  build: {
    outDir: "dist",
    sourcemap: true,

    // iPad 7th gen (A2197) tops out at iPadOS 17, but there is no guarantee the
    // wall device is current. safari14 is cheap insurance against a board that
    // white-screens because it was never updated; drop it once the device OS is
    // pinned in R14's runbook.
    target: ["es2020", "safari14"],
  },
});
