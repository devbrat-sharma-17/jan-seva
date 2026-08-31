// ============================================================
// Unauthorized — refused access
// ============================================================
// Says no without saying what was behind the door. No complaint ID, no
// department name, no hint about whether the resource exists.

import { Link, useNavigate } from 'react-router-dom';
import { logoutPortal } from '../../services/authService';
import { BrandMark } from '../ui/BrandMark';
import './auth.css';

interface UnauthorizedPageProps {
  /** Where "Back to dashboard" goes for whoever is actually signed in. */
  homePath?: string;
  signInPath?: string;
  /** One line of context. Must not name the resource that was refused. */
  detail?: string;
}

export function UnauthorizedPage({
  homePath = '/',
  signInPath = '/',
  detail = 'This area is restricted to authorised personnel.',
}: UnauthorizedPageProps) {
  const navigate = useNavigate();

  const handleSignInAgain = () => {
    logoutPortal();
    navigate(signInPath, { replace: true });
  };

  return (
    <div className="auth-notice">
      <div className="auth-notice__card">
        <span className="auth-notice__mark" aria-hidden="true">
          <BrandMark size={26} />
        </span>

        <span className="auth-notice__icon auth-notice__icon--deny" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>

        <h1 className="auth-notice__title">You don&rsquo;t have permission to view this page</h1>
        <p className="auth-notice__body">{detail}</p>

        <div className="auth-notice__actions">
          <Link to={homePath} className="auth-notice__btn auth-notice__btn--primary">
            Back to dashboard
          </Link>
          <button type="button" className="auth-notice__btn" onClick={handleSignInAgain}>
            Sign in again
          </button>
        </div>

        <p className="auth-notice__foot">
          If you believe you should have access, contact your department administrator.
        </p>
      </div>
    </div>
  );
}

/**
 * Shown when a session lapses while the portal is open, rather than
 * yanking the user to the sign-in screen mid-task.
 */
export function SessionExpiredPage({ signInPath }: { signInPath: string }) {
  return (
    <div className="auth-notice">
      <div className="auth-notice__card">
        <span className="auth-notice__mark" aria-hidden="true">
          <BrandMark size={26} />
        </span>

        <span className="auth-notice__icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15.5 14" />
          </svg>
        </span>

        <h1 className="auth-notice__title">Your session has expired</h1>
        <p className="auth-notice__body">Please sign in again to continue.</p>

        <div className="auth-notice__actions">
          <Link to={signInPath} className="auth-notice__btn auth-notice__btn--primary">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
