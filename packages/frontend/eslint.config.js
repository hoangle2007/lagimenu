import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-console': 'off',
      'no-debugger': 'error',
      // Large codebase: gradual typing — avoid blocking CI on legacy `any`
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react-refresh/only-export-components': 'warn',
      // Restore-from-storage / socket cleanup patterns; strict rule is noisy here
      'react-hooks/set-state-in-effect': 'off',
      // Intentionally omitted deps in effects across large pages (avoid churn / infinite loops)
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: ['**/components/ui.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['**/hooks/useAuth.tsx', '**/hooks/useAdminAuth.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
