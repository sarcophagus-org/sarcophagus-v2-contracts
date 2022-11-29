module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint", "import", "prettier", "node"],
  extends: [
    "plugin:prettier/recommended",
    "plugin:node/recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] },
    ],
    "node/no-unpublished-require": 0,
    "node/no-unpublished-import": 0,
    "comma-dangle": "off",
    "@typescript-eslint/indent": "off",
    // var rules
    "no-use-before-define": "off",
    "@typescript-eslint/comma-dangle": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-var-requires": "off",
  },
  overrides: [
    {
      files: ["*.spec.ts"],
      rules: {
        "no-unused-expressions": "off",
      },
    },
  ],
  settings: {
    // resolves imports without file extensions for listed extensions
    "import/resolver": {
      typescript: {
        extensions: [".js", ".ts", ".d.ts"],
      },
      node: {
        extensions: [".js", ".ts", ".d.ts"],
      },
    },
    node: {
      tryExtensions: [".js", ".json", ".ts", ".d.ts"],
    },
  },
};
