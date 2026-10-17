// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*"] },
  {
    // jest.mock() factories have to require() their modules.
    files: ["**/__tests__/**"],
    rules: { "@typescript-eslint/no-require-imports": "off", "react/display-name": "off" },
  },
]);
