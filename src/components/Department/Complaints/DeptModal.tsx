import React, { useEffect, useId, useRef } from 'react';

interface DeptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Small line under the title — usually the complaint ID and subject. */
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Dialog chrome shared by the assignment, progress and resolution modals.
 *
 * Each of those three opened with `if (!isOpen) return null` placed above
 * its `useState` calls, so the hook list changed length between renders.
 * Mounting is decided here instead, which lets the modal bodies keep their
 * hooks unconditional.
 */
export function DeptModal({ isOpen, onClose, title, subtitle, children }: DeptModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes, and the page behind stops scrolling while it is open.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog so the keyboard does not stay on the
    // trigger behind the backdrop.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="dept-modal-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="dept-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dept-modal__header">
          <div>
            <h2 className="dept-modal__title" id={titleId}>{title}</h2>
            {subtitle && <span className="dept-modal__sub">{subtitle}</span>}
          </div>
          <button type="button" className="dept-modal__close" onClick={onClose} aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
