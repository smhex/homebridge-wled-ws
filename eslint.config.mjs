import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["src/**/*.ts"],
    ignores: ["dist", "build", "test", "node_modules"],
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
]);
