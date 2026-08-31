// ============================================================
// useNetworkStatus — connectivity + sync state for portal UI
// ============================================================

import { useEffect, useState } from 'react';
import {
  getNetworkSnapshot,
  startNetworkMonitor,
  subscribeToNetwork,
  describeNetworkState,
  type NetworkSnapshot,
} from '../services/networkService';
import { startSyncEngine, getPendingOperations, subscribeToSyncQueue, type SyncOperation } from '../services/syncService';

export interface NetworkStatus extends NetworkSnapshot {
  label: string;
  detail: string;
  tone: 'neutral' | 'good' | 'warning' | 'danger';
  pending: SyncOperation[];
}

export function useNetworkStatus(): NetworkStatus {
  const [snapshot, setSnapshot] = useState<NetworkSnapshot>(() => getNetworkSnapshot());
  const [pending, setPending] = useState<SyncOperation[]>(() => getPendingOperations());

  useEffect(() => {
    // Idempotent: whichever portal shell mounts first starts both engines.
    startNetworkMonitor();
    startSyncEngine();

    const unsubNetwork = subscribeToNetwork(setSnapshot);
    const unsubQueue = subscribeToSyncQueue(setPending);

    // Catch anything that changed between first render and subscribing.
    setSnapshot(getNetworkSnapshot());
    setPending(getPendingOperations());

    return () => {
      unsubNetwork();
      unsubQueue();
    };
  }, []);

  const described = describeNetworkState(snapshot);
  return { ...snapshot, ...described, pending };
}
