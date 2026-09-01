// ============================================================
// useDeferredCityStats — live figures, off the critical path
// ============================================================
//
// The Hero's trust bar is derived from the complaint store, which is the
// right thing to do — the numbers there used to be constants, one of
// which contradicted another constant in the same object.
//
// But reading the store pulls in the seeded asset registry, the repair
// ledger, the ward profiles and eighteen months of complaint history:
// roughly 68 kB that has no business blocking the first paint of a
// landing page on a mid-range Android.
//
// So the module is imported dynamically, after the page has painted.
// Nothing else on the landing page touches the store, so this single
// deferral takes the entire service and seed graph off the critical
// path.
//
//   WHY THIS AND NOT ASYNC-SEEDING THE STORE.
//   The obvious alternative — make `readStore` seed asynchronously — is
//   worse. Every synchronous caller (tracking look-ups, department
//   queues, the metrics derivations) would have to defend against
//   reading an unseeded store, and one that forgot would silently show
//   an empty city. Deferring one import has no such failure mode: the
//   store stays synchronous and correct, and only the moment of reading
//   it moves.
//
// The trust bar sits below the fold and already counts up on scroll, so
// a brief placeholder is native to the design rather than a regression.

import { useEffect, useState } from 'react';
import type { LiveCityStats } from '../services/cityStatsService';

export interface DeferredCityStats {
  stats: LiveCityStats | null;
  /** False until the store has been loaded and read at least once. */
  ready: boolean;
}

/** Runs `fn` when the browser is idle, with a timeout fallback. */
function onIdle(fn: () => void): () => void {
  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  }).requestIdleCallback;

  if (typeof ric === 'function') {
    const handle = ric(fn, { timeout: 2000 });
    return () => {
      const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void })
        .cancelIdleCallback;
      cancel?.(handle);
    };
  }

  const timer = window.setTimeout(fn, 400);
  return () => window.clearTimeout(timer);
}

export function useDeferredCityStats(cityId: string): DeferredCityStats {
  const [stats, setStats] = useState<LiveCityStats | null>(null);

  useEffect(() => {
    // Guards against the import resolving after the component has gone —
    // React 18 strict mode mounts twice, and a citizen can navigate away
    // mid-fetch on a slow connection.
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const cancelIdle = onIdle(() => {
      void Promise.all([
        import('../services/cityStatsService'),
        import('../services/complaintService'),
      ])
        .then(([statsModule, complaintModule]) => {
          if (cancelled) return;

          const read = () => {
            if (!cancelled) setStats(statsModule.getLiveCityStats(cityId));
          };

          read();
          // Keeps the bar honest if a complaint is filed in another tab
          // while this page is open.
          unsubscribe = complaintModule.subscribeToComplaints(read);
        })
        .catch(() => {
          // A failed chunk fetch leaves the bar showing placeholders.
          // That is the correct outcome: an unknown figure is rendered
          // as unknown, never as zero.
        });
    });

    return () => {
      cancelled = true;
      cancelIdle();
      unsubscribe?.();
    };
  }, [cityId]);

  return { stats, ready: stats !== null };
}
