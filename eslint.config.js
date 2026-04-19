const nextPlugin = require('@next/eslint-plugin-next')
const reactCompiler = require('eslint-plugin-react-compiler')
const tsParser = require('@typescript-eslint/parser')

module.exports = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'dist/**',
      'build/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      'react-compiler': reactCompiler,
    },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-compiler/react-compiler': 'error',
    },
  },
]
