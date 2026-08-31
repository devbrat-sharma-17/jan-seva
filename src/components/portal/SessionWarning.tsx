// ============================================================
// Session warning — a heads-up before the idle timeout
// ============================================================
// Being signed out mid-form with no warning loses work. This gives a
// few minutes' notice, and any interaction extends the window, so
// dismissing it by carrying on working is the normal path.

import { extendSession } from '../../services/sessionService';
import { useSession } from '../../hooks/useSession';
import '../auth/auth.css';

export function SessionWarning() {
  const { endingSoon, minutesRemaining, refresh } = useSession();

  if (!endingSoon) return null;

  const handleStay = () => {
    extendSession();
    refresh();
  };

  return (
    <div className="session-warning" role="status" aria-live="polite">
      <span className="session-warning__text">
        Your session ends in about {minutesRemaining} minute
        {minutesRemaining === 1 ? '' : 's'} of inactivity.
      </span>
      <button type="button" className="session-warning__btn" onClick={handleStay}>
        Stay signed in
      </button>
    </div>
  );
}
