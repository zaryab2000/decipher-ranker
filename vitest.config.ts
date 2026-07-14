import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    setupFiles: ["./src/__tests__/setup.ts"],
    server: {
      deps: {
        inline: ["@agentcash/router"],
      },
    },
  },
});
