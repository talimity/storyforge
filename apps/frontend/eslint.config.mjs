// NOTE: we ONLY use eslint for detecting components that are not optimizable with React Compiler
// Biome is used for all other linting and formatting tasks

import tsParser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } }, // no type-aware linting needed
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // ...reactHooks.configs["recommended-latest"].rules,

      "react-hooks/incompatible-library": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/use-memo": "warn",

      // "react-hooks/component-hook-factories": "warn",
      // "react-hooks/config": "warn",
      // "react-hooks/error-boundaries": "warn",
      // "react-hooks/gating": "warn",
      // "react-hooks/globals": "warn",
      // "react-hooks/immutability": "warn",
      // "react-hooks/purity": "warn",
      // "react-hooks/refs": "warn",
      // "react-hooks/set-state-in-effect": "warn",
      // "react-hooks/set-state-in-render": "warn",
      // "react-hooks/static-components": "warn",
      // "react-hooks/unsupported-syntax": "warn",
    },
  },
]);
