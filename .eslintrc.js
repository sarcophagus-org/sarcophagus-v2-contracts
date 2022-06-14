module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] },
    ],
    "no-unused-vars": ["warn"],
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
    node: {
      tryExtensions: [".js", ".json", ".ts", ".d.ts"],
    },
  },
};
