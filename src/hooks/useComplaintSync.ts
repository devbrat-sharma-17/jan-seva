// ============================================================
// useComplaintSync — Keeps a tracked complaint current
// ============================================================
// Fetches the public projection for a Complaint ID, and — when the viewer
// has verified as the reporter — additionally resolves the full record.
// The public projection is always what renders unless verification holds.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Complaint, PublicComplaint, LookupOutcome } from '../types';
import { getById, getByIdVerified, subscribeToComplaints } from '../services/complaintService';
import { useIdentitySession } from './useIdentitySession';

/** SLA labels are minute-granular; a minute tick keeps them honest. */
const CLOCK_TICK_MS = 60 * 1000;

export interface ComplaintSyncState {
  /** Redacted view — safe to render for anyone holding the Complaint ID. */
  publicComplaint: PublicComplaint | null;
  /** Full record. Non-null only when the viewer verified as the reporter. */
  verifiedComplaint: Complaint | null;
  outcome: LookupOutcome | null;
  loading: boolean;
  refreshing: boolean;
  lastSyncedAt: number | null;
  refresh: () => void;
  clockTick: number;
}

export function useComplaintSync(complaintId: string | null): ComplaintSyncState {
  const { identity } = useIdentitySession();
  const identityReference = identity?.reference ?? null;

  const [outcome, setOutcome] = useState<LookupOutcome | null>(null);
  const [verifiedComplaint, setVerifiedComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(0);

  // Guards against a slow response for a previous id landing after the
  // user has navigated to a different complaint.
  const requestSeq = useRef(0);

  const load = useCallback(
    (id: string, mode: 'initial' | 'background' | 'manual') => {
      const seq = requestSeq.current + 1;
      requestSeq.current = seq;

      if (mode === 'initial') setLoading(true);
      if (mode === 'manual') setRefreshing(true);

      const publicLookup = getById(id);
      // Attempted in parallel; resolves to null unless the verified identity
      // actually matches this complaint's reporter.
      const verifiedLookup = identityReference
        ? getByIdVerified(id, identityReference)
        : Promise.resolve(null);

      Promise.all([publicLookup, verifiedLookup])
        .then(([result, verified]) => {
          if (seq !== requestSeq.current) return; // superseded
          setOutcome(result);
          setVerifiedComplaint(verified);
          setLastSyncedAt(Date.now());
        })
        .finally(() => {
          if (seq !== requestSeq.current) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    [identityReference]
  );

  useEffect(() => {
    if (!complaintId) {
      setOutcome(null);
      setVerifiedComplaint(null);
      setLastSyncedAt(null);
      requestSeq.current += 1; // cancel anything in flight
      return;
    }
    load(complaintId, 'initial');
  }, [complaintId, load]);

  // Store changes, in this tab or another
  useEffect(() => {
    if (!complaintId) return;
    return subscribeToComplaints(() => load(complaintId, 'background'));
  }, [complaintId, load]);

  // Re-check on return to the tab
  useEffect(() => {
    if (!complaintId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(complaintId, 'background');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [complaintId, load]);

  // Clock tick for time-derived labels (SLA countdown, "3 hours ago"),
  // and for retention: a complaint can expire while the page sits open.
  useEffect(() => {
    if (!complaintId) return;
    const timer = setInterval(() => setClockTick((n) => n + 1), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [complaintId]);

  const refresh = useCallback(() => {
    if (complaintId) load(complaintId, 'manual');
  }, [complaintId, load]);

  return {
    publicComplaint: outcome?.kind === 'found' ? outcome.complaint : null,
    verifiedComplaint,
    outcome,
    loading,
    refreshing,
    lastSyncedAt,
    refresh,
    clockTick,
  };
}

/**
 * The verified citizen's own complaints. Enabled only once an identity
 * reference exists — there is no code path that lists complaints for an
 * unverified visitor.
 */
export function useMyComplaints(
  fetcher: () => Promise<Complaint[]>,
  enabled: boolean
): { complaints: Complaint[]; loading: boolean; reload: () => void } {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(enabled);

  // Held in a ref so an inline arrow fetcher does not restart the
  // subscription on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    fetcherRef
      .current()
      .then(setComplaints)
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setComplaints([]);
      setLoading(false);
      return;
    }
    reload();
    return subscribeToComplaints(reload);
  }, [enabled, reload]);

  return { complaints, loading, reload };
}
