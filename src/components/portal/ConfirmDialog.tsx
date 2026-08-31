// ============================================================
// Confirm Dialog — high-impact actions, with an auditable reason
// ============================================================
// Reassigning a department or escalating by hand changes who is
// accountable for a citizen's complaint. Both ask for a written reason,
// which goes into the audit trail alongside who did it.

import React, { useEffect, useId, useRef, useState } from 'react';
import './portal.css';

interface Field {
  label: string;
  value: string;
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** One line of context above the fields. */
  description?: string;
  /** Before/after pairs, e.g. From: Water Services, To: Public Works. */
  fields?: Field[];
  /** Ask for a reason and require it before confirming. */
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive intent. */
  tone?: 'default' | 'danger';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  fields = [],
  requireReason = false,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Why is this change being made?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onCancel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  // Reopening should not inherit the last attempt's half-typed reason.
  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus lands on the field the user has to fill, not on the scrim.
    const focusTimer = setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 40);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(focusTimer);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const reasonMissing = requireReason && reason.trim().length < 4;

  const handleConfirm = () => {
    setTouched(true);
    if (reasonMissing) {
      firstFieldRef.current?.focus();
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div className="pdialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div
        className="pdialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <h2 className="pdialog__title" id={titleId}>
          {title}
        </h2>

        {description && <p className="pdialog__desc">{description}</p>}

        {fields.length > 0 && (
          <dl className="pdialog__fields">
            {fields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {children}

        {requireReason && (
          <div className="pdialog__field">
            <label className="pdialog__label" htmlFor={`${titleId}-reason`}>
              {reasonLabel} <span className="pdialog__required">required</span>
            </label>
            <textarea
              id={`${titleId}-reason`}
              ref={firstFieldRef}
              className="pdialog__textarea"
              rows={3}
              value={reason}
              placeholder={reasonPlaceholder}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && reasonMissing}
              aria-describedby={`${titleId}-reason-hint`}
            />
            <p className="pdialog__hint" id={`${titleId}-reason-hint`}>
              {touched && reasonMissing
                ? 'Enter a short reason — it is recorded in the audit trail.'
                : 'Recorded in the audit trail against your name.'}
            </p>
          </div>
        )}

        <div className="pdialog__actions">
          <button type="button" className="pdialog__btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`pdialog__btn pdialog__btn--confirm${tone === 'danger' ? ' pdialog__btn--danger' : ''}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
