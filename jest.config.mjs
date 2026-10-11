import { createDefaultPreset } from "ts-jest";

const tsJestTransformCfg = createDefaultPreset({ tsconfig: "tsconfig.test.json" }).transform;

export default {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
};
