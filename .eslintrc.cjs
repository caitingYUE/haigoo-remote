module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  settings: {
    // React plugin not used; keep JSX parsing via parserOptions
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        'no-undef': 'off',
        'no-useless-escape': 'off',
        'no-control-regex': 'off',
        'no-extra-semi': 'off',
        'no-empty': 'off',
        'prefer-const': 'warn',
        'no-case-declarations': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-unused-vars': 'off',
        'no-console': 'off',
        'react-refresh/only-export-components': 'off',
        'react-hooks/exhaustive-deps': 'warn'
      }
    },
    {
      files: ['src/pages/**/*.ts', 'src/pages/**/*.tsx', 'src/components/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }]
      }
    }
  ]
}
