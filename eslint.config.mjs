import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  { ignores: ["dist", "build", "test", "node_modules"],},
  { files: ["src/**/*.{ts}"] },
  tseslint.configs.recommended,
]);