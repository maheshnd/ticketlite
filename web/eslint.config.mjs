// ESLint for web/: the root rules, plus Next.js rules and the strict accessibility (jsx-a11y) rules.
// ESLint 10 picks the config file closest to each linted file, so this file applies to web/ only.
import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import root from "../eslint.config.mjs";

export default defineConfig(
  root,
  next,
  // eslint-config-next already registers the jsx-a11y plugin with its "recommended" rules.
  // We turn on the "strict" rule set on top. CONCEPT: accessibility
  { rules: jsxA11y.flatConfigs.strict.rules },
  {
    languageOptions: { globals: { React: "readonly" } },
    // Tell the Next.js rules where the app lives (lint runs from the repo root).
    settings: { next: { rootDir: "web/" } },
  },
  // Tool config files (postcss, next, ...) export a plain object by convention.
  { files: ["*.config.*"], rules: { "import/no-anonymous-default-export": "off" } },
);
