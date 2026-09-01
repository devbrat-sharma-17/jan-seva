// ============================================================
// useSpeechInput — dictate a complaint instead of typing it
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { speechLocaleTag } from '../services/i18nService';

/** Minimal shape of the vendor-prefixed API. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechInputResult {
  supported: boolean;
  listening: boolean;
  /** Words recognised but not yet finalised, for live feedback. */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * @param onTranscript Called with each FINALISED phrase. The caller
 *                     decides how to merge it — appending to whatever
 *                     the citizen has already typed, rather than
 *                     replacing it, is what makes dictation usable as a
 *                     supplement rather than an all-or-nothing mode.
 */
export function useSpeechInput(onTranscript: (text: string) => void): UseSpeechInputResult {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const supported = getRecognitionCtor() !== null;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('Voice input is not available in this browser.');
      return;
    }

    setError(null);
    const recognition = new Ctor();
    recognition.lang = speechLocaleTag();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let pending = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else pending += transcript;
      }

      setInterim(pending);
      if (finalText.trim()) onTranscript(finalText.trim());
    };

    recognition.onerror = (event) => {
      // `no-speech` fires constantly on a quiet street and is not worth
      // reporting; a permission denial is, because the citizen has to
      // do something about it.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(
        event.error === 'not-allowed'
          ? 'Microphone access was refused. You can still type your complaint.'
          : 'Voice input stopped unexpectedly. You can still type your complaint.'
      );
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError('Voice input could not be started.');
    }
  }, [onTranscript]);

  // A recogniser left running after the step unmounts keeps the
  // microphone indicator on, which reads as the app listening in the
  // background. It is not, and it must not look like it is.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
