interface StickyActionProps {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * The single contextual action for the complaint's current state.
 *
 * Deliberately one button: stacking "request update", "confirm resolution"
 * and "share" as competing full-width bars is how a mobile status page ends
 * up with more chrome than content. Everything else stays inline in the page.
 */
export function StickyAction({ label, hint, disabled = false, onClick }: StickyActionProps) {
  return (
    <div className="sticky-action">
      <button
        type="button"
        className="report-btn report-btn--primary sticky-action__btn"
        onClick={onClick}
        disabled={disabled}
      >
        {label}
      </button>
      {hint && <span className="sticky-action__hint">{hint}</span>}
    </div>
  );
}
