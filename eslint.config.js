import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'dist-admin',
    'vendor/**',
    'ci-output/**',
    'tools/ci/node_modules/**',
    'backend/node_modules/**',
    'android/**/build/**',
    'android/.gradle/**',
    'android/app/src/main/assets/public',
    'ios/App/App/public',
  ]),
  { files: ['backend/**/*.js', 'scripts/**/*.js'], languageOptions: { globals: globals.node }, rules: { 'react-hooks/rules-of-hooks': 'off' } },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
