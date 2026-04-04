import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "en",
  locales: ["en", "es", "de", "fr"],
  /** ESM so Vite SSR does not evaluate CommonJS `module.exports`. */
  compileNamespace: "es",
  catalogs: [
    {
      path: "<rootDir>/locales/{locale}/messages",
      include: ["app"],
      exclude: ["**/*.server.*", "**/*.test.*"]
    }
  ],
  format: "po"
});
