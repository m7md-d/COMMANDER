import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/**
 * Lint exists here to enforce CONSTITUTION.md, not to relitigate style.
 *
 * Formatting rules are deliberately absent: they generate noise and settle
 * nothing. What is encoded below are the rules the constitution states in prose
 * and that a reviewer would otherwise have to catch by eye — dependency
 * direction, function size, escape hatches.
 */

/** §2: a layer may not reach sideways or upwards. */
const layerBoundaries = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["../../*"],
          message: "CONSTITUTION §5.1: import through the @/ alias, not ../../",
        },
      ],
    },
  ],
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/generated/**",
      // Superseded Cloudflare Worker prototypes; a different constitution.
      "old/**",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      // The base rule cannot see type-only usage or overloads.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "off", // TypeScript already resolves every identifier.

      // §5: `any` erases the guarantee the language exists to give.
      "@typescript-eslint/no-explicit-any": "error",

      // §4: 40 lines per function. Blank lines and comments do not count —
      // a long function is long because of what it does.
      "max-lines-per-function": [
        "error",
        { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],

      // §4: three parameters, then a named object. The rule is about the call
      // site, not the signature — `gradeFor(tally, 3, 10, 25)` gives the reader
      // four numbers and no way to tell which one is the gold threshold.
      "max-params": ["error", 3],

      // §4: three levels. Turned on 2026-07-27 after measuring 24 breaches of
      // this and max-params that had accumulated while both were "reviewed by
      // eye" — which is the argument for the rule, not against it. We measure
      // nesting_depth in other people's repositories; not measuring it in our
      // own was the one gap worth closing first.
      "max-depth": ["error", 3],

      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  {
    files: ["apps/api/**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: layerBoundaries,
  },

  {
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: layerBoundaries,
  },

  {
    // A component's length lives in its markup, so §4's 40-line function budget
    // does not describe it. The component budget is per *file* (web §5, 150
    // lines) and is enforced by scripts/check-file-size.mjs instead.
    files: ["**/*.tsx"],
    rules: { "max-lines-per-function": "off" },
  },

  {
    // web CONSTITUTION §1, the one direction that must never invert: shared/ is
    // consumed by features and pages, and must not know either exists.
    files: ["apps/web/src/shared/**/*.ts", "apps/web/src/shared/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "../../features/*"],
              message: "shared/ may not import from features/ — move the shared part up",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
    rules: { "no-console": "off" },
  },

  {
    // Tests describe scenarios; a table of cases is not a long function.
    files: ["**/*.test.ts"],
    rules: { "max-lines-per-function": "off" },
  },
];
