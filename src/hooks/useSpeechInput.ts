// ============================================================
// useSpeechInput — dictate a complaint instead of typing it
// ============================================================
//
// React binding for `voiceInputService`. Everything browser-specific —
// the vendor prefix, the error vocabulary, the duplicate-result rules —
// lives in the service; this hook owns only the state machine the button
// renders from, and the guarantee that it always comes back to idle.
//
// The states, and what each one means to the citizen:
//
//   idle                  nothing is listening. The mic is closed.
//   requesting-permission started, waiting for the browser's prompt.
//   listening             the microphone is open.
//   processing            stop was asked for; final results still landing.
//   success               a phrase was captured; settles back to idle.
//   error                 see `errorCode`. Tapping the button retries.
//
// `error` is a resting state the citizen can act on, not a dead end:
// every recoverable code leaves the button live, so retrying is a tap
// rather than a page reload.

import { useCallback, useEffect, useRef, useState } from 'react';
import { speechLocaleTag } from '../services/i18nService';
import {
  isSupported as isVoiceSupported,
  startVoiceSession,
  type VoiceErrorCode,
  type VoiceSession,
} from '../services/voiceInputService';

export type VoiceStatus =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'processing'
  | 'success'
  | 'error';

export interface UseSpeechInputResult {
  supported: boolean;
  status: VoiceStatus;
  /** True while the microphone is open OR the prompt is up. */
  listening: boolean;
  /** Words recognised but not yet finalised, for live feedback. */
  interim: string;
  /** Null unless `status === 'error'`. The caller maps it to copy. */
  errorCode: VoiceErrorCode | null;
  start: () => void;
  stop: () => void;
}

/** How long a `success` flash rests before settling back to idle. */
const SUCCESS_SETTLE_MS = 1200;

/**
 * @param onTranscript Called with each FINALISED phrase. The caller
 *                     decides how to merge it — appending to whatever
 *                     the citizen has already typed, rather than
 *                     replacing it, is what makes dictation usable as a
 *                     supplement rather than an all-or-nothing mode.
 */
export function useSpeechInput(onTranscript: (text: string) => void): UseSpeechInputResult {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [interim, setInterim] = useState('');
  const [errorCode, setErrorCode] = useState<VoiceErrorCode | null>(null);

  const sessionRef = useRef<VoiceSession | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether this session produced anything, so `onEnd` knows whether it
  // ended in success or merely ended.
  const capturedRef = useRef(false);
  // Set once an error is reported, so `onEnd` does not overwrite the
  // error state with a bare idle and lose the message.
  const erroredRef = useRef(false);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const supported = isVoiceSupported();

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    // Not idle yet: results already spoken are still on their way, and
    // claiming idle before `onEnd` is how a phrase gets dropped.
    setStatus('processing');
    session.stop();
  }, []);

  const start = useCallback(() => {
    // A second tap while a session is live is a stop, never a second
    // recogniser — two open sessions is what makes Chrome throw and the
    // button stick.
    if (sessionRef.current) return;

    clearSettleTimer();
    capturedRef.current = false;
    erroredRef.current = false;
    setErrorCode(null);
    setInterim('');
    // The browser may be about to prompt. Saying "listening" before the
    // microphone is open would be a claim we cannot make yet.
    setStatus('requesting-permission');

    const session = startVoiceSession({
      lang: speechLocaleTag(),
      handlers: {
        onListening: () => setStatus('listening'),
        onInterim: (text) => setInterim(text),
        onFinal: (text) => {
          capturedRef.current = true;
          onTranscriptRef.current(text);
        },
        onError: (code) => {
          erroredRef.current = true;
          setErrorCode(code);
          setStatus('error');
        },
        onEnd: () => {
          sessionRef.current = null;
          setInterim('');
          if (erroredRef.current) return; // Keep the error on screen.
          if (!capturedRef.current) {
            setStatus('idle');
            return;
          }
          setStatus('success');
          settleTimerRef.current = setTimeout(() => {
            settleTimerRef.current = null;
            setStatus('idle');
          }, SUCCESS_SETTLE_MS);
        },
      },
    });

    // Null means the session never started and `onError`/`onEnd` have
    // already run synchronously — the state is settled, nothing to hold.
    sessionRef.current = session;
  }, [clearSettleTimer]);

  // A recogniser left running after the step unmounts keeps the
  // microphone indicator on, which reads as the app listening in the
  // background. It is not, and it must not look like it is.
  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
      sessionRef.current?.abort();
      sessionRef.current = null;
    },
    []
  );

  return {
    supported,
    status,
    listening: status === 'listening' || status === 'requesting-permission',
    interim,
    errorCode: status === 'error' ? errorCode : null,
    start,
    stop,
  };
}
