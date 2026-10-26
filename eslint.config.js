// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Per-icon lucide imports are resolved by metro.config.js
    rules: {
      "import/no-unresolved": ["error", { ignore: ["^lucide-react-native/icons/"] }],
    },
  },
]);
