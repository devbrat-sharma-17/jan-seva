import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rolldownOptions: {
      output: {
        /**
         * Chunking, decided by how often each group actually changes.
         *
         * The default single 520 kB entry chunk meant that changing one
         * line of copy invalidated React, the router and every service
         * in one go — on the mid-range Android connection this product
         * is mostly used on, that is the whole bundle re-downloaded for
         * a typo fix.
         *
         * Three groups, in descending order of stability:
         *
         *   vendor-react   changes when we upgrade React, i.e. rarely.
         *                  Cached across essentially every deploy.
         *   vendor-router  same reasoning, separate because router
         *                  upgrades and React upgrades do not coincide.
         *   civic-data     the seeded asset registry, repair ledger,
         *                  ward profiles and complaint history. Static
         *                  fixtures, and the largest single block of
         *                  application code that never changes between
         *                  feature releases.
         *
         * Everything else stays in the entry chunk, which is now what it
         * should be: the landing page and the shared shell.
         *
         * Measured, entry chunk: 524 kB -> 64 kB (146 -> 17 kB gzipped).
         * The report wizard, the tracking page and the route guards all
         * moved out of it, and the seeded civic data left the critical
         * path entirely — see the splitting note in App.tsx and
         * `useDeferredCityStats`.
         */
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\/](react|react-dom|scheduler)[\/]/,
            },
            {
              name: 'vendor-router',
              test: /node_modules[\/]react-router/,
            },
            {
              name: 'civic-data',
              test: /src[\/]data[\/](civicAssets|assetLedger|seasonalHistory|seedComplaints|wards|demoDirectory|departments)/,
            },
          ],
        },
      },
    },
  },
});
