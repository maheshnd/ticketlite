// ESLint flat config for the whole workspace. One file, so every package follows the same rules.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default defineConfig(
  // Step 1: never lint generated or built files.
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/.next/**",
      "**/coverage/**",
      "**/bin/**",
      "**/next-env.d.ts",
      "graphql/generated/**",
      "web/src/gql/**",
    ],
  },

  // Step 2: the recommended rule sets for JavaScript and TypeScript.
  // We skip the "type-checked" sets: they are slower and `tsc` already runs in CI.
  js.configs.recommended,
  tseslint.configs.recommended,

  // Step 3: everything in this repo runs on Node, unless a later block says otherwise (web/).
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Allow "_unused" names, a common way to say "this argument is intentionally ignored".
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // Step 4: last, so Prettier owns formatting and ESLint only reports real problems.
  prettier,
);
