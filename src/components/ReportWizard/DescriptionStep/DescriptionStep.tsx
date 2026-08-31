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
        </div>
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
