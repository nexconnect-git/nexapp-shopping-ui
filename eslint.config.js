const eslint = require("@eslint/js");
const angular = require("angular-eslint");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: [
      ".angular/**",
      ".backups/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "out-tsc/**",
      "customer-app-new-design-reference/**",
      "flashdrop-angular-instamart-style-v11-angular-structure/**",
    ],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: ["app", "fd", "nc"],
          style: "kebab-case",
        },
      ],
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: ["app", "table"],
          style: "camelCase",
        },
      ],
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "sort-imports": [
        "warn",
        {
          allowSeparatedGroups: true,
          ignoreCase: true,
          ignoreDeclarationSort: true,
          memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
        },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [...angular.configs.templateRecommended],
    rules: {
      "@angular-eslint/template/alt-text": "warn",
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/elements-content": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
      "@angular-eslint/template/label-has-associated-control": "warn",
      "@angular-eslint/template/mouse-events-have-key-events": "warn",
      "@angular-eslint/template/no-autofocus": "warn",
      "@angular-eslint/template/no-distracting-elements": "warn",
      "@angular-eslint/template/table-scope": "warn",
      "@angular-eslint/template/valid-aria": "warn",
    },
  },
);
