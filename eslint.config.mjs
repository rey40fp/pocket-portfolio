import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Disable rules that conflict with Prettier
  prettier,

  // Project-specific rules
  {
    rules: {
      // Prefer named exports (default only for pages)
      "import/prefer-default-export": "off",

      // Allow console.warn and console.error, flag console.log
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Enforce consistent return types on functions
      "@typescript-eslint/explicit-function-return-type": "off",

      // Allow unused vars when prefixed with underscore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Warn on 'any' — push towards proper typing
      "@typescript-eslint/no-explicit-any": "warn",

      // React: no need to import React in Next.js
      "react/react-in-jsx-scope": "off",

      // Allow spreading props (common in UI component libraries)
      "react/jsx-props-no-spreading": "off",

      // Enforce self-closing components without children
      "react/self-closing-comp": "warn",

      // Accessibility — keep a11y rules from next/core-web-vitals
      // but downgrade image alt to warning during development
      "@next/next/no-img-element": "warn",
    },
  },

  // Override default ignores of eslint-config-next
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
