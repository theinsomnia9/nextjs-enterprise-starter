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
      'src/generated/**',
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
  {
    files: ['src/**/*.{ts,tsx}', '__tests__/**/*.{ts,tsx}'],
    ignores: ['src/lib/ai/**', '__tests__/unit/lib/ai/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'openai',
              message:
                'Import from "@/lib/ai" instead. Only src/lib/ai/** may import the openai SDK directly.',
            },
            {
              name: '@langchain/openai',
              message:
                'Import from "@/lib/ai" instead. Only src/lib/ai/** may import @langchain/openai directly.',
            },
          ],
        },
      ],
    },
  },
]
