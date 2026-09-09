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
    R1's legacy override for `family-board.jsx` was removed here together with
    the file (R2 backlog item 6). Nothing under src/ needs the two relaxations
    it carried: the unused `React` import is gone with the prototype, and the
    four unescaped apostrophes are written as &apos; in
    src/components/settings/Settings.jsx. The whole tree is now held to the
    unrelaxed bar.
  */

  {
    files: ["**/*.{test,spec}.{js,jsx}", "src/test/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  /*
    Node-side files. `scripts/**` was added by R2 for
    scripts/extract-prototype-css.mjs, which reads the filesystem and writes
    to console — both undefined under the browser globals the src/ block sets.
  */
  {
    files: ["*.config.js", "api/**/*.js", "scripts/**/*.{js,mjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Last: turns off every stylistic rule Prettier owns.
  prettier,
];
