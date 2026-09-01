import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpeechInput } from '../../../hooks/useSpeechInput';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  DESCRIPTION_MAX_LENGTH,
  mergeTranscript,
  type VoiceErrorCode,
} from '../../../services/voiceInputService';
import './DescriptionStep.css';

const QUICK_HINTS_EN = [
  'Deep pothole on road',
  'Garbage overflow',
  'Water leakage from pipeline',
  'Broken streetlight',
  'Open manhole / drain',
  'Damaged footpath',
];

const QUICK_HINTS_HI = [
  'सड़क पर गहरा गड्ढा',
  'कचरा फैला हुआ है',
  'पाइपलाइन से पानी का रिसाव',
  'स्ट्रीट लाइट खराब है',
  'खुला मैनहोल / नाली',
  'टूटा हुआ फुटपाथ',
];

/**
 * One message per cause.
 *
 * The bug this replaced showed "Voice input requires an internet
 * connection" for a `network` error from the recogniser, which fires on
 * phones with working data whenever the speech service itself is
 * unreachable. A citizen told to fix their connection goes and checks a
 * connection that was never the problem.
 */
const VOICE_ERROR_KEYS: Record<VoiceErrorCode, string> = {
  UNSUPPORTED: 'report.voice.error.unsupported',
  INSECURE_CONTEXT: 'report.voice.error.insecure',
  PERMISSION_DENIED: 'report.voice.error.permission',
  SERVICE_UNAVAILABLE: 'report.voice.error.service',
  NETWORK_ERROR: 'report.voice.error.network',
  OFFLINE: 'report.voice.error.offline',
  NO_SPEECH: 'report.voice.error.noSpeech',
  AUDIO_CAPTURE_ERROR: 'report.voice.error.audioCapture',
  LANGUAGE_UNSUPPORTED: 'report.voice.error.language',
  // Never surfaced — the service swallows a stop the citizen asked for —
  // but the map has to be total.
  ABORTED: 'report.voice.error.unknown',
  UNKNOWN_ERROR: 'report.voice.error.unknown',
};

interface DescriptionStepProps {
  description: string;
  onChange: (desc: string) => void;
}

export function DescriptionStep({ description, onChange }: DescriptionStepProps) {
  const { t, locale } = useTranslation();
  const [transcriptTruncated, setTranscriptTruncated] = useState(false);

  /**
   * The description as of the last append, not as of the last render.
   *
   * Two phrases can be finalised before React re-renders, and a callback
   * closing over the `description` prop would then merge the second
   * phrase into the text that preceded the first — silently dropping it.
   * Writing the ref synchronously makes the next call see the previous
   * one.
   */
  const latestDescription = useRef(description);
  useEffect(() => {
    latestDescription.current = description;
  }, [description]);

  /* Dictated phrases are APPENDED, never substituted, and are held to
     the same 500-character limit as typing — the textarea's `maxLength`
     constrains keystrokes only, not a programmatic change. */
  const appendTranscript = useCallback(
    (text: string) => {
      const merged = mergeTranscript(latestDescription.current, text, DESCRIPTION_MAX_LENGTH);
      latestDescription.current = merged.text;
      setTranscriptTruncated(merged.truncated);
      onChange(merged.text);
    },
    [onChange]
  );

  const speech = useSpeechInput(appendTranscript);

  const quickHints = locale === 'hi' ? QUICK_HINTS_HI : QUICK_HINTS_EN;

  const handleTextChange = (value: string) => {
    setTranscriptTruncated(false);
    onChange(value);
  };

  const handleChipClick = (hint: string) => {
    setTranscriptTruncated(false);
    if (!description.trim()) {
      onChange(hint);
    } else {
      onChange(`${description.trim()}. ${hint}`);
    }
  };

  const handleVoiceClick = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    // An error is not a dead end: the same control retries, so a failed
    // attempt never costs the citizen a page reload.
    setTranscriptTruncated(false);
    speech.start();
  };

  return (
    <div className="desc-step">
      <div className="step-heading">
        <h2 className="step-heading__title">{t('report.desc.title')}</h2>
        <p className="step-heading__subtitle">{t('report.desc.subtitle')}</p>
      </div>

      <div className="desc-textarea-wrapper">
        <textarea
          className="desc-textarea"
          value={description}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={t('report.desc.placeholder')}
          maxLength={DESCRIPTION_MAX_LENGTH}
          rows={6}
          id="issue-description-input"
          aria-label={t('report.description.label')}
        />

        <div className="desc-counter-bar">
          <span>{t('report.desc.counter').replace('{count}', String(description.length))}</span>

          {speech.supported ? (
            <button
              type="button"
              className={`desc-voice-btn${speech.listening ? ' is-listening' : ''}`}
              onClick={handleVoiceClick}
              disabled={speech.status === 'processing'}
              aria-pressed={speech.listening}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
              <span>
                {speech.listening ? t('report.voice.stop') : t('report.voice.start')}
              </span>
            </button>
          ) : (
            <span className="desc-voice-unsupported">{t('report.voice.unsupported')}</span>
          )}
        </div>

        {speech.listening && (
          <p className="desc-voice-live" role="status" aria-live="polite">
            <span className="desc-voice-live__dot" aria-hidden="true" />
            {/* The microphone is not open until the browser says it is —
                claiming "listening" over a permission prompt would be a
                claim about recording that is not yet true. */}
            {speech.status === 'requesting-permission'
              ? t('report.voice.requesting')
              : t('report.voice.listening')}
            {speech.interim && <em> — “{speech.interim}”</em>}
          </p>
        )}

        {speech.errorCode && (
          <p className="desc-voice-error" role="alert">
            {t(VOICE_ERROR_KEYS[speech.errorCode])}
          </p>
        )}

        {transcriptTruncated && (
          <p className="desc-voice-note" role="status">
            {t('report.voice.truncated')}
          </p>
        )}

        {speech.supported && (
          <p className="desc-voice-note">
            {t('report.voice.note')}
          </p>
        )}
      </div>

      <div className="desc-suggestions-section">
        <span className="desc-suggestions-label">{t('report.desc.suggestions')}</span>
        <div className="desc-chips-row">
          {quickHints.map((hint) => (
            <button
              key={hint}
              type="button"
              className="desc-chip-btn"
              onClick={() => handleChipClick(hint)}
            >
              + {hint}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
