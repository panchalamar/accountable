// ESLint for the frontend: the recommended TypeScript, React Hooks and
// accessibility rules, plus a cap on cyclomatic complexity.
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["frontend/dist/**", "frontend/coverage/**"] },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      complexity: ["error", 15],
    },
  },
);
