import { useCallback } from 'react';
import { useSpeechInput } from '../../../hooks/useSpeechInput';
import { useTranslation } from '../../../hooks/useTranslation';
import './DescriptionStep.css';


interface DescriptionStepProps {
  description: string;
  onChange: (desc: string) => void;
}

const QUICK_HINTS = [
  'Deep pothole on road',
  'Garbage overflow',
  'Water leakage from pipeline',
  'Broken streetlight',
  'Open manhole / drain',
  'Damaged footpath',
];

export function DescriptionStep({ description, onChange }: DescriptionStepProps) {
  const { t, locale } = useTranslation();

  /* Dictated phrases are APPENDED, never substituted. A citizen who has
     typed two lines and then dictates a third must not lose the two. */
  const appendTranscript = useCallback(
    (text: string) => {
      onChange(description.trim() ? `${description.trim()} ${text}` : text);
    },
    [description, onChange]
  );

  const speech = useSpeechInput(appendTranscript);

  const handleChipClick = (hint: string) => {
    if (!description.trim()) {
      onChange(hint);
    } else {
      onChange(`${description.trim()}. ${hint}`);
    }
  };

  return (
    <div className="desc-step">
      <div className="step-heading">
        <h2 className="step-heading__title">Tell us what happened</h2>
        <p className="step-heading__subtitle">
          Describe the problem briefly.
        </p>
      </div>

      <div className="desc-textarea-wrapper">
        <textarea
          className="desc-textarea"
          value={description}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Example: Large pothole near City Centre is causing traffic problems and hazard for two-wheelers."
          maxLength={500}
          rows={6}
          id="issue-description-input"
          aria-label="Issue description"
        />

        <div className="desc-counter-bar">
          <span>{description.length} / 500 characters</span>

          {speech.supported ? (
            <button
              type="button"
              className={`desc-voice-btn${speech.listening ? ' is-listening' : ''}`}
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
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
            {t('report.voice.listening')}
            {speech.interim && <em> — “{speech.interim}”</em>}
          </p>
        )}

        {speech.error && (
          <p className="desc-voice-error" role="alert">
            {speech.error}
          </p>
        )}

        {/* Said plainly rather than pitched. Speaking in Hindi works
            because the classifier's keyword list is Hindi/Hinglish
            aware, not because a translation layer exists. */}
        {speech.supported && (
          <p className="desc-voice-note">
            {locale === 'hi'
              ? 'हिंदी में बोल सकते हैं — शिकायत उसी भाषा में दर्ज होगी।'
              : 'You can speak in Hindi or English. Either is understood.'}
          </p>
        )}
      </div>

      <div className="desc-suggestions-section">
        <span className="desc-suggestions-label">Quick Suggestions</span>
        <div className="desc-chips-row">
          {QUICK_HINTS.map((hint) => (
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
