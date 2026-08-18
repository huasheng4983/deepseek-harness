// Per-package build config (plain JS so no TS config-loader is needed):
// mirrors the repo root tsdown.config.ts host-face settings for this package.
// Used by CI/dev to build just this package: node ../../node_modules/tsdown/dist/run.mjs -c tsdown.config.mjs
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  clean: false,
  dts: false,
})
