// ============================================================
// useLiveData — recompute a derived view when the records change
// ============================================================
//
// The admin screens each held their figures in `useMemo(..., [])`, which
// computes once and never again. A department updating a complaint in
// another tab — or in this one — left the Command Centre showing numbers
// from whenever the page happened to mount.
//
// This subscribes to the complaint store instead. Storage events cover
// other tabs; the in-tab custom event covers this one. There is no poll.

import { useCallback, useEffect, useState } from 'react';
import { subscribeToComplaints } from '../services/complaintService';

/**
 * @param compute  Derives the view. Must be stable — wrap it in
 *                 `useCallback` at the call site, or define it outside
 *                 the component.
 */
export function useLiveData<T>(compute: () => T): T {
  const [value, setValue] = useState<T>(compute);

  const refresh = useCallback(() => setValue(compute()), [compute]);

  useEffect(() => {
    refresh();
    return subscribeToComplaints(refresh);
  }, [refresh]);

  return value;
}
