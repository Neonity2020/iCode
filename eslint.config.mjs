import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['.vite', 'out', 'dist', '**/dist', '**/node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/renderer/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['packages/main/src/**/*.ts', 'packages/preload/src/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
)
