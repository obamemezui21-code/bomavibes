import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Reviewed case by case: every hit is the load-on-mount / reset-on-
      // sign-out / fill-form-from-loaded-data pattern, not a render loop.
      // Kept visible as a warning so new code still gets flagged.
      'react-hooks/set-state-in-effect': 'warn',
      // Each context file exports its provider plus its matching hook —
      // the standard React pattern; fast refresh handles these fine.
      'react-refresh/only-export-components': [
        'error',
        { allowExportNames: ['useAuth', 'useCall', 'useConversations', 'useFeed', 'useTheme', 'useToast'] },
      ],
    },
  },
])
