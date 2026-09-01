// ============================================================
// Voice input suite
// ============================================================
// Appended to the main self-test so `npm run selftest` covers it.
//
// This exists because of one production bug that no amount of manual
// clicking would have caught reliably: a `network` error from the speech
// recogniser was rendered to citizens as "Voice input requires an
// internet connection", on phones with working mobile data. The two are
// different failures — the phone's connection, and the recogniser's
// reachability — and the mapping that keeps them apart is now asserted
// rather than assumed.
//
// The recogniser itself is faked. What is under test is our own
// handling: the error vocabulary, the duplicate-result rules, the
// 500-character limit, and the guarantee that the session always ends.

import { check, checkEqual, section } from './harness';
import type { VoiceErrorCode } from '../services/voiceInputService';

// ------------------------------------------------------------
// A stand-in for the browser's SpeechRecognition
// ------------------------------------------------------------

interface FakeResult {
  isFinal: boolean;
  0: { transcript: string };
  length: number;
}

function result(transcript: string, isFinal: boolean): FakeResult {
  return { isFinal, 0: { transcript }, length: 1 };
}

class FakeRecognition {
  static last: FakeRecognition | null = null;
  /** Set to make `start()` throw, as Chrome does for a double start. */
  static throwOnStart = false;
  /** Set to make the recogniser go silent — nothing starts, nothing fails. */
  static silent = false;

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  started = false;
  aborted = false;
  stopped = false;

  onstart: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<FakeResult> }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.last = this;
  }

  start(): void {
    if (FakeRecognition.throwOnStart) throw new Error('InvalidStateError');
    this.started = true;
    if (!FakeRecognition.silent) {
      this.onstart?.();
      this.onaudiostart?.();
    }
  }

  stop(): void {
    this.stopped = true;
    this.onend?.();
  }

  abort(): void {
    this.aborted = true;
    this.onend?.();
  }

  /** Delivers one `onresult` carrying the whole accumulated result list. */
  emit(results: FakeResult[], resultIndex: number): void {
    this.onresult?.({ resultIndex, results });
  }

  fail(error: string): void {
    this.onerror?.({ error });
    this.onend?.();
  }
}

interface Recorded {
  listening: number;
  interim: string[];
  finals: string[];
  errors: VoiceErrorCode[];
  ends: number;
}

function recorder(): { seen: Recorded; handlers: Parameters<typeof import('../services/voiceInputService').startVoiceSession>[0]['handlers'] } {
  const seen: Recorded = { listening: 0, interim: [], finals: [], errors: [], ends: 0 };
  return {
    seen,
    handlers: {
      onListening: () => {
        seen.listening += 1;
      },
      onInterim: (text: string) => {
        seen.interim.push(text);
      },
      onFinal: (text: string) => {
        seen.finals.push(text);
      },
      onError: (code: VoiceErrorCode) => {
        seen.errors.push(code);
      },
      onEnd: () => {
        seen.ends += 1;
      },
    },
  };
}

export async function runVoiceSuite(): Promise<void> {
  const voice = await import('../services/voiceInputService');
  const g = globalThis as Record<string, unknown>;
  const win = g.window as Record<string, unknown>;

  // ==========================================================
  section('Voice input — error vocabulary');
  // ==========================================================

  // THE REGRESSION. A recogniser that cannot reach its service and a
  // phone with no connection both arrive as `network`, and used to be
  // told to the citizen with the same sentence.
  checkEqual(
    'An online device reports a recogniser it could not reach',
    voice.mapRecognitionError('network', true),
    'NETWORK_ERROR'
  );
  checkEqual(
    'An offline device reports being offline',
    voice.mapRecognitionError('network', false),
    'OFFLINE'
  );
  check(
    'The two are never the same code',
    voice.mapRecognitionError('network', true) !== voice.mapRecognitionError('network', false)
  );

  // Everything else is decided by the error itself, and connectivity
  // must not colour any of it.
  const invariant: Array<[string, VoiceErrorCode]> = [
    ['not-allowed', 'PERMISSION_DENIED'],
    ['service-not-allowed', 'SERVICE_UNAVAILABLE'],
    ['audio-capture', 'AUDIO_CAPTURE_ERROR'],
    ['no-speech', 'NO_SPEECH'],
    ['aborted', 'ABORTED'],
    ['language-not-supported', 'LANGUAGE_UNSUPPORTED'],
    ['bad-grammar', 'UNKNOWN_ERROR'],
    ['something-new-from-a-future-chrome', 'UNKNOWN_ERROR'],
  ];

  for (const [raw, expected] of invariant) {
    checkEqual(`'${raw}' maps to ${expected}`, voice.mapRecognitionError(raw, true), expected);
    checkEqual(
      `'${raw}' maps the same way offline`,
      voice.mapRecognitionError(raw, false),
      expected
    );
  }

  check(
    'A permission denial is never reported as a connection problem',
    voice.mapRecognitionError('not-allowed', true) !== 'NETWORK_ERROR' &&
      voice.mapRecognitionError('not-allowed', false) !== 'OFFLINE'
  );
  check(
    'An unavailable service is never reported as a connection problem',
    voice.mapRecognitionError('service-not-allowed', false) !== 'OFFLINE'
  );

  // ==========================================================
  section('Voice input — merging a phrase into the description');
  // ==========================================================

  checkEqual(
    'A phrase lands in an empty field as-is',
    voice.mergeTranscript('', 'there is a pothole').text,
    'there is a pothole'
  );
  checkEqual(
    'A phrase is appended to typed text, not substituted for it',
    voice.mergeTranscript('Near City Centre.', 'There is a deep pothole.').text,
    'Near City Centre. There is a deep pothole.'
  );
  checkEqual(
    'Text the citizen typed is preserved exactly',
    voice.mergeTranscript('  leading space kept', 'and this').text,
    '  leading space kept and this'
  );
  checkEqual(
    'A trailing space does not become a double space',
    voice.mergeTranscript('first ', 'second').text,
    'first second'
  );
  checkEqual('An empty phrase changes nothing', voice.mergeTranscript('typed', '   ').text, 'typed');
  check(
    'And an empty phrase is not reported as truncated',
    !voice.mergeTranscript('typed', '   ').truncated
  );

  // Successive phrases chain, which is the case that used to drop the
  // first one when the caller merged into a stale value.
  let acc = '';
  for (const phrase of ['pothole near the crossing', 'water is standing in it', 'since Monday']) {
    acc = voice.mergeTranscript(acc, phrase).text;
  }
  checkEqual(
    'Three dictated phrases accumulate, none lost',
    acc,
    'pothole near the crossing water is standing in it since Monday'
  );

  // The 500-character field limit. `maxLength` on the textarea governs
  // typing only; a dictated phrase arrives through onChange and would
  // sail straight past it.
  const nearFull = 'x'.repeat(490);
  const overflow = voice.mergeTranscript(nearFull, 'a much longer dictated phrase than fits');
  check('A phrase that overruns the limit is cut', overflow.truncated);
  check(
    'And the field never exceeds 500 characters',
    overflow.text.length <= voice.DESCRIPTION_MAX_LENGTH
  );
  check('The text already in the field survives the cut', overflow.text.startsWith(nearFull));

  const full = voice.mergeTranscript('y'.repeat(500), 'anything at all');
  checkEqual('A full field is left exactly as it was', full.text, 'y'.repeat(500));
  check('And the citizen is told nothing was added', full.truncated);

  const exact = voice.mergeTranscript('z'.repeat(495), 'abcd');
  checkEqual('A phrase that fits exactly is not cut', exact.text.length, 500);
  check('And is not reported as truncated', !exact.truncated);

  // ==========================================================
  section('Voice input — sessions');
  // ==========================================================

  // Nothing is installed yet: this is a browser without the API.
  check('An absent recogniser reads as unsupported', !voice.isSupported());

  const noSupport = recorder();
  checkEqual(
    'Starting without support creates no session',
    voice.startVoiceSession({ lang: 'en-IN', handlers: noSupport.handlers }),
    null
  );
  checkEqual('It reports UNSUPPORTED', noSupport.seen.errors[0], 'UNSUPPORTED');
  checkEqual('And it still ends, so the button returns to idle', noSupport.seen.ends, 1);

  // Install the fake recogniser and a secure context.
  win.SpeechRecognition = FakeRecognition;
  win.isSecureContext = true;
  check('A present recogniser reads as supported', voice.isSupported());

  // -- Insecure origin -------------------------------------------------
  win.isSecureContext = false;
  const insecure = recorder();
  checkEqual(
    'A plain-HTTP origin starts no session',
    voice.startVoiceSession({ lang: 'en-IN', handlers: insecure.handlers }),
    null
  );
  checkEqual(
    'It names the insecure context rather than blaming the connection',
    insecure.seen.errors[0],
    'INSECURE_CONTEXT'
  );
  checkEqual('And it ends', insecure.seen.ends, 1);
  win.isSecureContext = true;

  // -- The happy path --------------------------------------------------
  const ok = recorder();
  const session = voice.startVoiceSession({ lang: 'hi-IN', handlers: ok.handlers });
  check('A session starts', session !== null);
  const rec = FakeRecognition.last!;
  checkEqual('The recogniser is set to the requested language', rec.lang, 'hi-IN');
  checkEqual('Listening is announced once the microphone opens', ok.seen.listening, 1);
  checkEqual('No error is reported', ok.seen.errors.length, 0);

  // Interim then final for the SAME result index — the shape that used
  // to produce doubled text.
  rec.emit([result('sadak par', false)], 0);
  rec.emit([result('sadak par gaddha hai', false)], 0);
  rec.emit([result('sadak par gaddha hai', true)], 0);
  checkEqual('A phrase is finalised exactly once', ok.seen.finals.length, 1);
  checkEqual('With the final text, not an interim one', ok.seen.finals[0], 'sadak par gaddha hai');

  // A second phrase, delivered as a growing result list — Chrome's shape
  // in continuous mode.
  rec.emit([result('sadak par gaddha hai', true), result('paani bhara hai', true)], 1);
  checkEqual('A second phrase is delivered', ok.seen.finals.length, 2);
  checkEqual('And it is the new one', ok.seen.finals[1], 'paani bhara hai');

  // Safari re-delivers earlier results in later events.
  rec.emit([result('sadak par gaddha hai', true), result('paani bhara hai', true)], 0);
  checkEqual('A redelivered result is not appended twice', ok.seen.finals.length, 2);

  session!.stop();
  checkEqual('Stopping ends the session', ok.seen.ends, 1);
  check('And the recogniser was told to stop', rec.stopped);
  checkEqual('The interim buffer is cleared on end', ok.seen.interim.at(-1), '');

  // -- A denied microphone ---------------------------------------------
  const denied = recorder();
  const deniedSession = voice.startVoiceSession({ lang: 'en-IN', handlers: denied.handlers });
  FakeRecognition.last!.fail('not-allowed');
  checkEqual('A refused microphone is reported as a permission problem', denied.seen.errors[0], 'PERMISSION_DENIED');
  checkEqual('The session ends rather than sticking on "Listening"', denied.seen.ends, 1);
  deniedSession?.abort();
  checkEqual('Aborting an already-ended session does not end it twice', denied.seen.ends, 1);

  // -- A recogniser that cannot reach its service ----------------------
  const netFail = recorder();
  voice.startVoiceSession({ lang: 'en-IN', handlers: netFail.handlers });
  FakeRecognition.last!.fail('network');
  checkEqual(
    'An online device gets the recogniser error, not an internet warning',
    netFail.seen.errors[0],
    'NETWORK_ERROR'
  );

  // -- A stop the citizen asked for is not an error --------------------
  const abortCase = recorder();
  voice.startVoiceSession({ lang: 'en-IN', handlers: abortCase.handlers });
  FakeRecognition.last!.fail('aborted');
  checkEqual('An abort raises no error at the citizen', abortCase.seen.errors.length, 0);
  checkEqual('But it still ends the session', abortCase.seen.ends, 1);

  // -- A recogniser that refuses to start ------------------------------
  FakeRecognition.throwOnStart = true;
  const threw = recorder();
  checkEqual(
    'A recogniser that throws on start yields no session',
    voice.startVoiceSession({ lang: 'en-IN', handlers: threw.handlers }),
    null
  );
  checkEqual('It reports an unknown failure', threw.seen.errors[0], 'UNKNOWN_ERROR');
  checkEqual('And returns to idle rather than sticking', threw.seen.ends, 1);
  FakeRecognition.throwOnStart = false;

  // -- A recogniser that goes silent -----------------------------------
  // The worst case: no start, no error, no end. The button would read
  // "Listening…" forever, which looks like the app is recording.
  FakeRecognition.silent = true;
  const silent = recorder();
  const silentSession = voice.startVoiceSession({ lang: 'en-IN', handlers: silent.handlers });
  check('A silent recogniser still returns a session', silentSession !== null);
  checkEqual('Nothing is claimed to be listening', silent.seen.listening, 0);
  checkEqual('And nothing has ended yet', silent.seen.ends, 0);
  // The watchdog is a timer, so the citizen-facing guarantee is checked
  // by driving the teardown the timer would drive.
  silentSession!.abort();
  checkEqual('Abandoning it returns to idle', silent.seen.ends, 1);
  FakeRecognition.silent = false;

  // -- Cleanup ---------------------------------------------------------
  const unmount = recorder();
  const live = voice.startVoiceSession({ lang: 'en-IN', handlers: unmount.handlers });
  live!.abort();
  check('Unmounting aborts the recogniser, closing the microphone', FakeRecognition.last!.aborted);
  checkEqual('And ends the session exactly once', unmount.seen.ends, 1);

  delete win.SpeechRecognition;
  delete win.isSecureContext;
}
