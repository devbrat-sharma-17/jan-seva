import type { ReportStep } from '../../types/report';

interface ProgressIndicatorProps {
  currentStep: ReportStep;
}

export function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  if (typeof currentStep !== 'number') {
    return null;
  }

  // 5 total citizen steps
  const percentage = (currentStep / 5) * 100;

  return (
    <div className="report-progress" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={5}>
      <div className="report-progress__bar" style={{ width: `${percentage}%` }} />
    </div>
  );
}
