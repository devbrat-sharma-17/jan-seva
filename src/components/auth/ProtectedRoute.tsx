// ============================================================
// Route Guards — Admin & Department
// ============================================================
//
// Reaching a portal screen requires an authenticated session of the right
// role. Typing the URL, restoring a tab, or following a stale bookmark all
// land here first.
//
//   These guards keep the UI honest. They are not access control.
//   Nothing rendered in a browser can be. The API must re-check role and
//   department scope on every request; a guard that passes only means the
//   client believed it had a session.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { UnauthorizedPage } from './UnauthorizedPage';

/**
 * Query keys a department user could use to try to widen their own scope.
 * The session is the only source of department scope; a request that
 * disagrees with it is refused rather than silently ignored, so the
 * attempt is visible instead of looking like it worked.
 */
const SCOPE_OVERRIDE_KEYS = ['dept', 'department', 'departmentId'];

function signInRedirect(loginPath: string, expired: boolean, from: string) {
  const params = new URLSearchParams();
  if (expired) params.set('reason', 'expired');
  if (from && from !== '/') params.set('from', from);
  const query = params.toString();
  return <Navigate to={query ? `${loginPath}?${query}` : loginPath} replace />;
}

export function ProtectedAdminRoute() {
  const { status } = useSession();
  const location = useLocation();

  if (status.kind !== 'active') {
    return signInRedirect('/admin/login', status.kind === 'expired', location.pathname);
  }

  if (status.session.role !== 'admin') {
    return (
      <UnauthorizedPage
        homePath="/department/dashboard"
        signInPath="/admin/login"
        detail="The Command Centre is limited to municipal administrator accounts."
      />
    );
  }

  return <Outlet />;
}

export function ProtectedDepartmentRoute() {
  const { status } = useSession();
  const location = useLocation();

  if (status.kind !== 'active') {
    return signInRedirect('/department/login', status.kind === 'expired', location.pathname);
  }

  const { session } = status;

  if (session.role !== 'department' || !session.departmentId) {
    return (
      <UnauthorizedPage
        homePath="/admin/dashboard"
        signInPath="/department/login"
        detail="The operations portal is limited to department staff accounts."
      />
    );
  }

  // A department scope asked for in the URL that is not the session's own.
  const params = new URLSearchParams(location.search);
  const requestedScope = SCOPE_OVERRIDE_KEYS.map((k) => params.get(k)).find(Boolean);

  if (requestedScope && requestedScope.toLowerCase() !== session.departmentId) {
    return (
      <UnauthorizedPage
        homePath="/department/dashboard"
        signInPath="/department/login"
        detail="Your account is scoped to a single department."
      />
    );
  }

  return <Outlet />;
}
