import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Only the `@/` alias from tsconfig, so a test can import a module that itself
// imports app code that way (proxy.ts, for the middleware matcher).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
