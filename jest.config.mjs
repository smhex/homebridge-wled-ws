import { createDefaultPreset } from "ts-jest";

// Keep dynamic import intact so HAP integration tests support CommonJS and ESM releases.
// npm test checks types separately before this isolated transformation.
const tsJestTransformCfg = createDefaultPreset({
  tsconfig: {
    module: "NodeNext",
    moduleResolution: "NodeNext",
    isolatedModules: true,
    target: "ES2018",
    esModuleInterop: true,
  },
}).transform;

export default {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
};
