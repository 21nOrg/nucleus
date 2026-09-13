import path from "node:path";

import tsconfigPaths from "vite-tsconfig-paths";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { buildViteAliases, loadAliasMap } from "../tools/alias-utils.mjs";

export const repoRoot = path.resolve(__dirname, "..");

const workspaceAliases = Object.entries(buildViteAliases(loadAliasMap())).map(
  ([find, replacement]) => ({
    find,
    replacement
  })
);

export const alias = [
  { find: "@tests", replacement: path.join(repoRoot, "tests") },
  { find: "$lib", replacement: repoRoot },
  { find: "$lib/", replacement: repoRoot + "/" },
  ...workspaceAliases
];

export const basePlugins = [
  tsconfigPaths({
    projects: [path.join(repoRoot, "tsconfig.json")]
  })
];

export const baseSetupFile = path.join(__dirname, "test.setup.ts");

export const coverageConfig = (name: string) => ({
  provider: "v8" as const,
  enabled: true,
  reporter: ["text", "html", "lcov"],
  reportsDirectory: path.join(repoRoot, "coverage", name),
  exclude: [
    "tests/fixtures/**",
    "apps/e2e-playwright/**",
    "**/*.d.ts",
    "**/*.config.*",
    "**/node_modules/**"
  ],
  thresholds: {
    lines: 70,
    statements: 70,
    functions: 70,
    branches: 70
  }
});

export const clientPlugins = [
  ...basePlugins,
  svelte({ preprocess: vitePreprocess({ script: true }) })
];
