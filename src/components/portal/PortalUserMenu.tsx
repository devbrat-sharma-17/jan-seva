// ============================================================
// Portal user menu — identity, scope, and the way out
// ============================================================
// Signing out has to be one predictable click from anywhere in either
// portal, and it has to actually invalidate the session rather than
// navigate away from it.

import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutPortal } from '../../services/authService';
import { useSession } from '../../hooks/useSession';
import './portal.css';

interface PortalUserMenuProps {
  name: string;
  roleTitle: string;
  /** Department name for staff; city for administrators. */
  scope: string;
  signInPath: string;
  tone?: 'light' | 'dark';
}

function initialsOf(name: string): string {
  return name
    .replace(/^(Er\.|Dr\.|Shri|Smt\.)\s*/, '')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function PortalUserMenu({
  name,
  roleTitle,
  scope,
  signInPath,
  tone = 'light',
}: PortalUserMenuProps) {
  const navigate = useNavigate();
  const { status, minutesRemaining } = useSession();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSignOut = () => {
    // Clear first, navigate second: the guard on the next route must see
    // an empty session, not race the redirect.
    logoutPortal();
    setOpen(false);
    navigate(signInPath, { replace: true });
  };

  return (
    <div className={`pmenu pmenu--${tone}`} ref={wrapperRef}>
      <button
        type="button"
        ref={buttonRef}
        className="pmenu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pmenu__avatar" aria-hidden="true">
          {initialsOf(name)}
        </span>
        <span className="pmenu__id">
          <span className="pmenu__name">{name}</span>
          <span className="pmenu__role">{roleTitle}</span>
        </span>
        <svg
          className={`pmenu__chevron${open ? ' is-open' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="pmenu__panel" id={menuId} role="menu">
          <div className="pmenu__head">
            <span className="pmenu__head-name">{name}</span>
            <span className="pmenu__head-meta">{roleTitle}</span>
            <span className="pmenu__head-scope">{scope}</span>
          </div>

          <div className="pmenu__section">
            <p className="pmenu__section-title">Session</p>
            <p className="pmenu__section-body">
              {status.kind === 'active'
                ? `Signed in. Ends after ${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'} of inactivity.`
                : 'No active session.'}
            </p>
            <p className="pmenu__section-note">
              Authorised personnel only. Some information is restricted by role.
            </p>
          </div>

          <button type="button" role="menuitem" className="pmenu__signout" onClick={handleSignOut}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
