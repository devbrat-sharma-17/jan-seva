// ============================================================
// useComplaintMutation — every write has a visible state
// ============================================================
//
// An officer who taps "Start work" and sees nothing change assumes it
// failed and taps again. This hook makes the four outcomes a portal
// mutation can have impossible to leave unrendered:
//
//   idle -> saving -> saved
//                  -> queued    (offline; saved on the device)
//                  -> failed    (with the reason and a retry)
//                  -> conflict  (someone else moved the record)

import { useCallback, useRef, useState } from 'react';
import type { Complaint } from '../types';
import type { OperationResult } from '../services/complaintService';
import { useToast } from '../components/ui/Toast';

export type MutationPhase = 'idle' | 'saving' | 'saved' | 'queued' | 'failed' | 'conflict';

export interface MutationState {
  phase: MutationPhase;
  message: string;
  /** On a conflict: the record as it now stands. */
  latest?: Complaint;
}

export interface UseComplaintMutationResult {
  state: MutationState;
  /** Which action is in flight, so only that button shows a spinner. */
  pendingAction: string | null;
  isBusy: boolean;
  run: (
    action: string,
    operation: () => Promise<OperationResult>,
    options?: { successMessage?: string; onSuccess?: (complaint: Complaint) => void }
  ) => Promise<OperationResult>;
  reset: () => void;
}

/** How long a success state stays on screen before returning to idle. */
const SETTLE_MS = 2600;

export function useComplaintMutation(): UseComplaintMutationResult {
  const { showToast } = useToast();
  const [state, setState] = useState<MutationState>({ phase: 'idle', message: '' });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    setState({ phase: 'idle', message: '' });
  }, []);

  const settle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      setState({ phase: 'idle', message: '' });
    }, SETTLE_MS);
  }, []);

  const run = useCallback<UseComplaintMutationResult['run']>(
    async (action, operation, options = {}) => {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }

      setPendingAction(action);
      setState({ phase: 'saving', message: 'Saving…' });

      let result: OperationResult;
      try {
        result = await operation();
      } catch {
        // The service layer returns failures rather than throwing, so
        // reaching here means something unexpected broke. The user still
        // gets plain language, never the exception text.
        result = {
          ok: false,
          reason: 'invalid',
          message: 'That change could not be saved. Please try again.',
        };
      }

      setPendingAction(null);

      if (result.ok) {
        const message = result.queued
          ? 'Saved on this device. It will sync when you are back online.'
          : options.successMessage ?? 'Change saved.';

        setState({ phase: result.queued ? 'queued' : 'saved', message });
        showToast(message, result.queued ? 'warning' : 'success');
        options.onSuccess?.(result.complaint);
        settle();
        return result;
      }

      if (result.reason === 'conflict') {
        setState({ phase: 'conflict', message: result.message, latest: result.latest });
        showToast('This complaint was updated elsewhere.', 'warning');
        return result;
      }

      setState({ phase: 'failed', message: result.message });
      showToast(result.message, 'error');
      return result;
    },
    [settle, showToast]
  );

  return {
    state,
    pendingAction,
    isBusy: pendingAction !== null,
    run,
    reset,
  };
}
