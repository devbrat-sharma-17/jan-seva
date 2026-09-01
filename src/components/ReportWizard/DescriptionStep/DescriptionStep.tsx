import { useCallback } from 'react';
import { useSpeechInput } from '../../../hooks/useSpeechInput';
import { useTranslation } from '../../../hooks/useTranslation';
import './DescriptionStep.css';

interface DescriptionStepProps {
  description: string;
  onChange: (desc: string) => void;
}

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

export function DescriptionStep({ description, onChange }: DescriptionStepProps) {
  const { t, locale } = useTranslation();

  /* Dictated phrases are APPENDED, never substituted. */
  const appendTranscript = useCallback(
    (text: string) => {
      onChange(description.trim() ? `${description.trim()} ${text}` : text);
    },
    [description, onChange]
  );

  const speech = useSpeechInput(appendTranscript);

  const quickHints = locale === 'hi' ? QUICK_HINTS_HI : QUICK_HINTS_EN;

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
        <h2 className="step-heading__title">{t('report.desc.title')}</h2>
        <p className="step-heading__subtitle">{t('report.desc.subtitle')}</p>
      </div>

      <div className="desc-textarea-wrapper">
        <textarea
          className="desc-textarea"
          value={description}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('report.desc.placeholder')}
          maxLength={500}
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
