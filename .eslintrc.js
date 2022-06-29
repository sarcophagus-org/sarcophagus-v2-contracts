module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: [
    "@typescript-eslint",
    "import",
    "prettier",
    "node"
  ],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
    "plugin:import/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] }
    ],
    "comma-dangle": "off",
    indent: "off",
    "@typescript-eslint/indent": "off",
    // prettier config
    "prettier/prettier": [
      1,
      {
        printWidth: 100,
        endOfLine: "lf",
        tabWidth: 2,
        useTabs: false,
        singleQuote: false,
        semi: true,
        arrowParens: "avoid",
        singleAttributePerLine: true,
      },
    ],
    // var rules
    "no-use-before-define": "warn",
    "@typescript-eslint/comma-dangle": "off",
    "@typescript-eslint/no-use-before-define": "error",
    "@typescript-eslint/no-unused-vars": "off",
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
      typescript: {},
      node: {
        extensions: [".ts", ".d.ts"],
      },
    },
    node: {
      tryExtensions: [".js", ".json", ".ts", ".d.ts"],
    },
  },
};
