// Bundles the self-test for Node. The app build is untouched.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/selftest/run.ts',
    outDir: 'dist-selftest',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rollupOptions: {
      output: { entryFileNames: 'run.mjs' },
    },
  },
});
