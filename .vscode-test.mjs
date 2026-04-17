import { defineConfig } from "@vscode/test-cli";

export default defineConfig([
  {
    label: "unit",
    files: "out/test/unit/**/*.test.js",
    mocha: { timeout: 10000 },
    headless: true,
  },
]);
