// Bundles the production-mode lockout suite for Node.
//
// Separate from the main self-test because the two need opposite worlds:
// `run.ts` exercises the demo directory and the seeded complaint history,
// which is precisely what this build asserts is gone. Built with
// `--mode production` so it picks up `.env.production`, i.e. the same
// VITE_APP_MODE the deployed bundle gets.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/selftest/production.ts',
    outDir: 'dist-selftest-prod',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rollupOptions: {
      output: { entryFileNames: 'run.mjs' },
    },
  },
});
