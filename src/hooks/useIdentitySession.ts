// ============================================================
// useIdentitySession — Verified-citizen context
// ============================================================
// Single source of truth for "has this browser verified, and as whom".
// Every privilege above public tracking is gated on it.

import { useCallback, useEffect, useState } from 'react';
import type { VerifiedIdentity } from '../services/identityService';
import {
  getVerifiedIdentity,
  clearVerifiedIdentity,
  subscribeToIdentity,
} from '../services/identityService';

export interface IdentitySession {
  identity: VerifiedIdentity | null;
  isVerified: boolean;
  signOut: () => void;
  /** True when the session verifies the citizen who filed this complaint. */
  canAccess: (identityReference: string | undefined) => boolean;
}

export function useIdentitySession(): IdentitySession {
  const [identity, setIdentity] = useState<VerifiedIdentity | null>(() => getVerifiedIdentity());

  useEffect(() => {
    const refresh = () => setIdentity(getVerifiedIdentity());

    const unsubscribe = subscribeToIdentity(refresh);

    // The session has a TTL, so a tab left open must not stay "verified"
    // visually after it lapses. Re-reading on focus catches that, and also
    // picks up a sign-out performed in another tab.
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const signOut = useCallback(() => {
    clearVerifiedIdentity();
    setIdentity(null);
  }, []);

  const canAccess = useCallback(
    (identityReference: string | undefined) =>
      Boolean(identity && identityReference && identity.reference === identityReference),
    [identity]
  );

  return { identity, isVerified: identity !== null, signOut, canAccess };
}
