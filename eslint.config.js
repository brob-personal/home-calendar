import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

/*
  PLAN.md names this deliverable `.eslintrc`. ESLint 9 — the version this
  project installs — reads flat config and will not load `.eslintrc` without a
  deprecation shim, so the config lands here under the supported filename. Same
  deliverable, current format. Noted for R0.
*/
export default [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", ".vercel/**"],
  },

  js.configs.recommended,

  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,

      // Backlog item 3: react-hooks rules on. These are the rules that catch
      // the class of bug the plan is already tracking — stale closures, missing
      // deps, effects that re-register listeners on every edit (Defect #3).
      ...reactHooks.configs.recommended.rules,

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Off deliberately, project-wide. React 19 removed propTypes from the
      // library entirely, so this rule demands a dead API. PLAN.md §R3 makes
      // JSDoc typedefs in src/contracts/ the shape contract instead; that is
      // where prop shapes get enforced.
      "react/prop-types": "off",

      // The prototype is a single 2,100-line module that exports one component
      // and keeps every helper local. Flagging those helpers as unused-export
      // noise would bury real findings, so unused *variables* still error while
      // unused args are allowed an underscore escape hatch.
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],

      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
    },
  },

  /*
    Legacy override — delete this block together with the file.

    `family-board.jsx` is the untouched artifact prototype. R1 is forbidden to
    edit it and R2 deletes it at the end of Wave 0 (R2 backlog item 6), so its
    two remaining rule violations are relaxed here rather than in the source.
    Both are cosmetic and neither is worth a Deferred Defect:

      - `React` is imported but unused: correct under the automatic JSX runtime
        the Vite React plugin uses. The import simply becomes redundant.
      - 4x unescaped apostrophes in JSX copy (:1535, :1536, :1606).

    New code under src/ is held to the unrelaxed bar.
  */
  {
    files: ["family-board.jsx"],
    rules: {
      "react/no-unescaped-entities": "off",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^(_|React$)",
          caughtErrors: "none",
        },
      ],
    },
  },

  {
    files: ["**/*.{test,spec}.{js,jsx}", "src/test/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  {
    files: ["*.config.js", "api/**/*.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Last: turns off every stylistic rule Prettier owns.
  prettier,
];
