// ============================================================
// useSession — portal session state for guards and shells
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  getSessionStatus,
  msUntilExpiry,
  subscribeToSession,
  touchSession,
  SESSION_WARNING_MS,
  type SessionStatus,
} from '../services/sessionService';

/**
 * Expiry has to be noticed without a user action, so there is a timer —
 * but at 20s, not 1s. The window it watches is 30 minutes; a finer tick
 * would burn renders to shave seconds off a boundary nobody is watching.
 */
const EXPIRY_CHECK_MS = 20_000;

/** Interaction events that count as "still working". */
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'keydown',
  'focus',
];

export interface UseSessionResult {
  status: SessionStatus;
  /** True inside the warning window before the idle timeout. */
  endingSoon: boolean;
  /** Whole minutes left, for the warning copy. */
  minutesRemaining: number;
  /** Re-reads the session immediately. */
  refresh: () => void;
}

export function useSession(): UseSessionResult {
  const [status, setStatus] = useState<SessionStatus>(() => getSessionStatus());
  const [remaining, setRemaining] = useState<number>(() => msUntilExpiry());

  const refresh = useCallback(() => {
    setStatus(getSessionStatus());
    setRemaining(msUntilExpiry());
  }, []);

  useEffect(() => subscribeToSession(refresh), [refresh]);

  useEffect(() => {
    const timer = setInterval(refresh, EXPIRY_CHECK_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Real interaction slides the idle window forward. `touchSession` rate
  // limits itself to one write a minute, so these listeners are cheap.
  useEffect(() => {
    if (status.kind !== 'active') return;

    const onActivity = () => touchSession();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [status.kind]);

  const endingSoon = status.kind === 'active' && remaining > 0 && remaining <= SESSION_WARNING_MS;

  return {
    status,
    endingSoon,
    minutesRemaining: Math.max(0, Math.ceil(remaining / 60_000)),
    refresh,
  };
}
