import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist", "build", "node_modules"]),
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // Indent with 2 spaces
      indent: ['error', 2, { SwitchCase: 1 }],
      'no-tabs': 'error',
      'no-mixed-spaces-and-tabs': 'error',

      // Use single quotes for strings
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],      
      semi: ['error', 'always'],
    },
  },
  tseslint.configs.recommended,
  {
    // Mocks are cast to any, and jest.mock() factories have to use require()
    files: ["test/**/*.ts"],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
