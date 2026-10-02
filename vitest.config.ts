import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // DISPATCH logs every event; keep test output to failures.
    onConsoleLog: (log) => !log.startsWith("[dispatch]"),
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
