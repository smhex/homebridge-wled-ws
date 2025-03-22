import eslintRecommended from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  // Allgemeine Konfiguration für alle Dateien
  {
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettierPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...eslintRecommended.configs.recommended.rules, // ESLint empfohlene Regeln
      ...tseslint.configs.recommended.rules, // TypeScript empfohlene Regeln
      'prettier/prettier': ['error', { singleQuote: true }], // Prettier-Formatierung als Fehler
    },
  },

  // Spezifische Konfiguration für TypeScript-Dateien
  {
    files: ['src/**/*.ts'],
    rules: {
      'max-len': ['error', { code: 80 }], // Maximale Zeilenlänge für TypeScript
      'max-lines': ['error', { max: 1000 }], // Maximale Anzahl an Zeilen
    },
  },

  // Konfliktlösungen für Prettier
  prettierConfig,
];
