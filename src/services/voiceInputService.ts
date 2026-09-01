// ============================================================
// Voice Input Service — the browser's speech recogniser, honestly reported
// ============================================================
//
// Built on the browser's own SpeechRecognition, which needs no key, no
// backend and no bundle. With the locale set to Hindi it dictates in
// Hindi, and the existing classifier's keyword list is already
// Hindi/Hinglish-aware, so a dictated Hindi complaint routes correctly
// without a translation step.
//
//   THIS IS ACCESSIBILITY, NOT INNOVATION.
//   CPGRAMS NextGen already has voice-to-text and multilingual filing;
//   DARPG launched the Samadhan Didi voice chatbot in May 2026; Bhashini
//   has run native-language complaint registration in eleven languages.
//   The honest framing is that typing a paragraph on a phone keyboard is
//   the single biggest barrier to filing, and this removes it.
//
// The production path is Bhashini's ASR — India's own language DPI —
// which covers far more languages and far more accents than a browser
// engine does. This is the zero-backend stand-in for it.
//
// ------------------------------------------------------------
// Why this is a service and not just a hook
// ------------------------------------------------------------
// The bug this module was extracted to fix was a category error, and it
// was easy to make while the mapping lived inline in a component's hook:
// the Web Speech API's `network` error was rendered to citizens as
//
//     "Voice input requires an internet connection."
//
// on devices that were demonstrably online. `network` from a speech
// recogniser does not mean "this phone has no internet". It means the
// recognition BACKEND could not be reached, or the audio stream to it
// failed, which happens routinely on a fully connected device:
//
//   - Chromium builds shipped without Google's speech API keys (Brave,
//     Vivaldi, ungoogled-chromium) fail every recognition attempt.
//   - Networks that reach our origin but block the speech endpoint —
//     campus, office and some ISP-level filters.
//   - A continuous session whose socket to the recogniser drops mid-phrase.
//
// Device connectivity and recogniser availability are two different
// questions, so they get two different answers. `navigator.onLine` is
// consulted for exactly one purpose here: to tell an offline device
// apart from an unreachable service, both of which surface as `network`.

/** The one field length the whole dictation path has to respect. */
export const DESCRIPTION_MAX_LENGTH = 500;

/**
 * Every way voice input can fail, as a code rather than a sentence.
 *
 * The service decides WHAT went wrong; the component decides what to say
 * about it, in the citizen's language. Baking English copy in here is
 * what let a Hindi UI render English error text.
 */
export type VoiceErrorCode =
  | 'UNSUPPORTED'
  | 'INSECURE_CONTEXT'
  | 'PERMISSION_DENIED'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'NO_SPEECH'
  | 'AUDIO_CAPTURE_ERROR'
  | 'LANGUAGE_UNSUPPORTED'
  | 'ABORTED'
  | 'UNKNOWN_ERROR';

// ------------------------------------------------------------
// The vendor-prefixed API, minimally typed
// ------------------------------------------------------------

interface SpeechRecognitionResultLike extends ArrayLike<{ transcript: string }> {
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

/**
 * Standard name first, `webkit` prefix second. Neither is guaranteed:
 * Firefox ships the interface only behind a flag, and the Android
 * WebViews inside other apps frequently ship neither.
 */
function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/**
 * Microphone capture is gated on a secure context. `localhost` counts as
 * one, which is why dictation can work in `npm run dev` and fail on a
 * plain-HTTP deployment — and why this is checked before start rather
 * than inferred afterwards from Chrome's `not-allowed`, which it reports
 * for BOTH a denied permission and an insecure origin.
 *
 * The fix for a false here is to serve the site over HTTPS, never to
 * weaken the check.
 */
export function isSecureContextForVoice(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.isSecureContext === 'boolean') return window.isSecureContext;
  return true; // Nothing to assert against; let the browser decide.
}

function isDeviceOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/**
 * Maps a `SpeechRecognitionErrorEvent.error` to our code.
 *
 * Pure and exported so the self-test can pin the mapping down — this is
 * the exact function whose `network` case used to lie to citizens.
 *
 * @param online Device connectivity AT THE MOMENT OF THE ERROR. Only
 *               `network` consults it, and only to separate "this phone
 *               has no connection" from "the recogniser is unreachable".
 */
export function mapRecognitionError(raw: string, online: boolean): VoiceErrorCode {
  switch (raw) {
    case 'no-speech':
      return 'NO_SPEECH';
    case 'aborted':
      return 'ABORTED';
    case 'audio-capture':
      return 'AUDIO_CAPTURE_ERROR';
    case 'not-allowed':
      return 'PERMISSION_DENIED';
    // Chrome reports this when the recognition service itself refuses the
    // request: a Chromium build without Google speech credentials, or an
    // enterprise policy. The citizen's connection is irrelevant to it.
    case 'service-not-allowed':
      return 'SERVICE_UNAVAILABLE';
    case 'language-not-supported':
      return 'LANGUAGE_UNSUPPORTED';
    case 'network':
      return online ? 'NETWORK_ERROR' : 'OFFLINE';
    case 'bad-grammar':
      return 'UNKNOWN_ERROR';
    default:
      return 'UNKNOWN_ERROR';
  }
}

// ------------------------------------------------------------
// Merging a dictated phrase into what the citizen already typed
// ------------------------------------------------------------

export interface TranscriptMerge {
  text: string;
  /** The phrase did not fit whole, and was cut to the field limit. */
  truncated: boolean;
}

/**
 * Appends a recognised phrase to the existing text, never replacing it.
 *
 * `maxLength` is enforced here rather than left to the textarea, because
 * the element's `maxLength` constrains TYPING only — a programmatic
 * `onChange` sails straight past it, and a long dictation could push the
 * description over the 500 characters the rest of the pipeline assumes.
 *
 * Truncation prefers a word boundary; a description cut mid-word reads
 * as data loss even when it is the citizen's own last word.
 */
export function mergeTranscript(
  existing: string,
  phrase: string,
  maxLength: number = DESCRIPTION_MAX_LENGTH
): TranscriptMerge {
  const addition = phrase.trim();
  if (!addition) return { text: existing, truncated: false };

  // Only trailing whitespace is dropped, so that text the citizen typed
  // is preserved exactly as they typed it.
  const base = existing.replace(/\s+$/, '');
  const joiner = base ? ' ' : '';
  const candidate = base + joiner + addition;

  if (candidate.length <= maxLength) return { text: candidate, truncated: false };

  const room = maxLength - base.length - joiner.length;
  if (room <= 0) return { text: existing, truncated: true };

  const slice = addition.slice(0, room);
  const lastSpace = slice.lastIndexOf(' ');
  const kept = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;

  return { text: (base + joiner + kept).replace(/\s+$/, ''), truncated: true };
}

// ------------------------------------------------------------
// A recognition session
// ------------------------------------------------------------

export interface VoiceSessionHandlers {
  /** The microphone is open and the recogniser is listening. */
  onListening(): void;
  /** Words heard but not yet finalised, for live feedback. Never stored. */
  onInterim(text: string): void;
  /** A finalised phrase. Emitted exactly once per result. */
  onFinal(text: string): void;
  onError(code: VoiceErrorCode): void;
  /** Always fires last, error or not. The caller returns to idle here. */
  onEnd(): void;
}

export interface VoiceSession {
  /** Finish cleanly; results already captured are still delivered. */
  stop(): void;
  /** Drop the session immediately. Used on unmount. */
  abort(): void;
}

/**
 * Some browsers neither start nor fail: with the speech endpoint blocked
 * by a filtering proxy, `start()` returns and no event ever arrives. The
 * button would sit on "Listening…" forever, which is the single worst
 * outcome here — it looks like the app is recording the citizen. This is
 * how long we wait for the microphone to actually open before calling it
 * unavailable and tearing the session down.
 */
const AUDIO_START_TIMEOUT_MS = 10_000;

export interface StartVoiceOptions {
  /** BCP-47 tag, e.g. `hi-IN` or `en-IN`. */
  lang: string;
  handlers: VoiceSessionHandlers;
}

/**
 * Starts recognition, or reports why it cannot.
 *
 * Returns null only when no session was created — support, secure
 * context, or a constructor that threw. `handlers.onError` and
 * `handlers.onEnd` still fire in that case, so the caller has one path
 * back to idle rather than two.
 *
 * MUST be called synchronously from the citizen's tap. Anything awaited
 * first can cost the user activation that iOS Safari requires.
 */
export function startVoiceSession(options: StartVoiceOptions): VoiceSession | null {
  const { lang, handlers } = options;

  const fail = (code: VoiceErrorCode): null => {
    handlers.onError(code);
    handlers.onEnd();
    return null;
  };

  const Ctor = getRecognitionCtor();
  if (!Ctor) return fail('UNSUPPORTED');
  if (!isSecureContextForVoice()) return fail('INSECURE_CONTEXT');

  let recognition: SpeechRecognitionLike;
  try {
    recognition = new Ctor();
  } catch {
    return fail('UNKNOWN_ERROR');
  }

  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  // ----------------------------------------------------------
  // Session-local state
  // ----------------------------------------------------------

  /**
   * Absolute indices of results already handed to `onFinal`.
   *
   * Interim and final results arrive for the SAME result index — first
   * `isFinal: false` while the phrase is being recognised, then
   * `isFinal: true` once it settles. Trusting `event.resultIndex` alone
   * is not enough either: Safari re-delivers earlier results in later
   * events, so a phrase can be finalised twice. Emitting per index, once,
   * is duplicate-proof under both behaviours.
   */
  const emitted = new Set<number>();
  let finished = false;
  let audioStarted = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  const clearWatchdog = (): void => {
    if (watchdog !== null) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  };

  /** Detaches every handler. A live recogniser holds the microphone. */
  const detach = (): void => {
    recognition.onstart = null;
    recognition.onaudiostart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    clearWatchdog();
    detach();
    handlers.onEnd();
  };

  const markListening = (): void => {
    if (audioStarted || finished) return;
    audioStarted = true;
    clearWatchdog();
    handlers.onListening();
  };

  // ----------------------------------------------------------
  // Wiring
  // ----------------------------------------------------------

  // Between `start()` and one of these, the browser may be showing its
  // permission prompt — which is what lets the caller tell "asking for
  // the microphone" apart from "listening" without an async pre-flight
  // that would break the gesture chain.
  recognition.onstart = markListening;
  recognition.onaudiostart = markListening;

  recognition.onresult = (event) => {
    if (finished) return;

    // A result can only come from an open microphone, so if the start
    // events were missed, this is proof enough.
    markListening();

    let interim = '';

    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (!result) continue;
      const transcript = result[0]?.transcript ?? '';

      if (result.isFinal) {
        if (emitted.has(i)) continue;
        emitted.add(i);
        if (transcript.trim()) handlers.onFinal(transcript.trim());
      } else {
        interim += transcript;
      }
    }

    handlers.onInterim(interim.trim());
  };

  recognition.onerror = (event) => {
    if (finished) return;
    clearWatchdog();

    const code = mapRecognitionError(event.error, isDeviceOnline());

    // A stop the citizen asked for is not a failure to report back to
    // them. `onend` still follows and returns the button to idle.
    if (code !== 'ABORTED') handlers.onError(code);

    handlers.onInterim('');
  };

  recognition.onend = () => {
    handlers.onInterim('');
    finish();
  };

  watchdog = setTimeout(() => {
    if (finished || audioStarted) return;
    // Nothing started and nothing failed. The recogniser is unreachable;
    // the citizen's connection is not the thing to talk about.
    handlers.onError('SERVICE_UNAVAILABLE');
    try {
      recognition.abort();
    } catch {
      // Aborting a recogniser that never started can throw; the session
      // is being torn down regardless.
    }
    finish();
  }, AUDIO_START_TIMEOUT_MS);

  try {
    recognition.start();
  } catch {
    // Chrome throws InvalidStateError when a session is already running.
    clearWatchdog();
    detach();
    finished = true;
    handlers.onError('UNKNOWN_ERROR');
    handlers.onEnd();
    return null;
  }

  return {
    stop: () => {
      clearWatchdog();
      try {
        recognition.stop();
      } catch {
        finish();
      }
    },
    abort: () => {
      clearWatchdog();
      try {
        recognition.abort();
      } catch {
        // Already gone.
      }
      finish();
    },
  };
}
