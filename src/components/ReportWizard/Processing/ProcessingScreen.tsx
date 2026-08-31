import { useState, useEffect } from 'react';
import './ProcessingScreen.css';

export function ProcessingScreen() {
  const [stepIndex, setStepIndex] = useState<number>(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStepIndex(1), 400);
    const timer2 = setTimeout(() => setStepIndex(2), 800);
    const timer3 = setTimeout(() => setStepIndex(3), 1200);
    const timer4 = setTimeout(() => setStepIndex(4), 1600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  const steps = [
    { label: 'Photos analyzed with computer vision', threshold: 1 },
    { label: 'Location verified & mapped to zone', threshold: 2 },
    { label: 'Issue classified & severity scored', threshold: 3 },
    { label: 'Checking for existing reports nearby', threshold: 4 },
  ];

  return (
    <div className="proc-screen" role="status" aria-live="polite">
      <div className="proc-radar-spinner">
        <div className="proc-radar-inner-dot">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
      </div>

      <div className="proc-heading">
        <h2 className="proc-title">Analyzing your report...</h2>
        <p className="proc-subtitle">
          JAN-SEVA is categorizing the issue and preparing routing.
        </p>
      </div>

      <div className="proc-checklist">
        {steps.map((s, idx) => {
          const isDone = stepIndex >= s.threshold;
          const isActive = stepIndex === s.threshold - 1;
          const className = isDone
            ? 'proc-step-item proc-step-item--done'
            : isActive
            ? 'proc-step-item proc-step-item--active'
            : 'proc-step-item proc-step-item--pending';

          return (
            <div key={idx} className={className}>
              <div className="proc-icon-box">
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span style={{ fontSize: '10px' }}>●</span>
                )}
              </div>
              <span>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
