// ============================================================
// Admin Command Centre — sign-in
// ============================================================
// Credentials lead; the demo shortcut sits below, labelled as what it is.
// The previous version had it the other way round, which made a one-click
// entry look like the authentication step.

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { loginAdmin, startAdminDemoSession } from '../../services/authService';
import { getThrottleState } from '../../services/loginThrottle';
import { DEMO_PASSWORD_HINT, getDemoAdminAccount } from '../../data/demoDirectory';
import { demoAccountsAllowed } from '../../config/appMode';
import { BrandHomeLink } from '../ui/BrandHomeLink';
import { BrandMark } from '../ui/BrandMark';
import { AdminIcon } from './AdminIcon';
import './AdminLogin.css';

export function AdminLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lockSeconds, setLockSeconds] = useState(0);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const identifierRef = useRef<HTMLInputElement>(null);
  const showDemoZone = demoAccountsAllowed();
  const demoAccount = getDemoAdminAccount();

  // Where the guard bounced them from, so a sign-in returns them to it.
  const returnTo = searchParams.get('from') || '/admin/dashboard';
  const wasExpired = searchParams.get('reason') === 'expired';

  // The lockout is a countdown, so it needs a tick — but only while one
  // is actually running.
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = setInterval(() => {
      const state = getThrottleState(identifier);
      setLockSeconds(state.secondsRemaining);
      if (!state.locked) setError('');
    }, 1000);
    return () => clearInterval(timer);
  }, [lockSeconds, identifier]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('credentials');
    setError('');

    const result = await loginAdmin({ identifier, password });

    if (result.ok) {
      // The password never leaves this component, and does not linger in
      // state after the attempt that used it.
      setPassword('');
      navigate(returnTo, { replace: true });
      return;
    }

    setBusy(null);
    setError(result.message);
    setLockSeconds(result.secondsRemaining ?? 0);
    setPassword('');
    if (result.reason !== 'rate_limited') identifierRef.current?.focus();
  };

  const handleQuickDemo = () => {
    setBusy('demo');
    startAdminDemoSession();
    navigate(returnTo, { replace: true });
  };

  const locked = lockSeconds > 0;

  return (
    <div className="admin-login">
      {/* ---- Context rail ---- */}
      <aside className="admin-login__aside">
        <div className="admin-login__aside-inner">
          <BrandHomeLink tone="onDark" size="md" />

          <p className="admin-login__lede">
            City-wide oversight of every civic complaint in Gwalior.
          </p>

          <ul className="admin-login__points">
            <li>Track service delivery across all five departments</li>
            <li>Act on SLA breaches and citizen escalations</li>
            <li>Publish initiatives and export performance reports</li>
          </ul>

          <p className="admin-login__aside-foot">
            Gwalior Municipal Corporation &middot; Madhya Pradesh
          </p>
        </div>
      </aside>

      {/* ---- Auth column ---- */}
      <main className="admin-login__main">
        <div className="admin-login__card">
          <header className="admin-login__head">
            <span className="admin-login__badge">
              <BrandMark size={22} />
              <span className="admin-login__badge-word">JAN-SEVA</span>
              <span className="admin-login__badge-tag">Admin</span>
            </span>

            <h1 className="admin-login__title">Command centre sign-in</h1>
            <p className="admin-login__subtitle">
              Authorised municipal administrators only.
            </p>
          </header>

          {wasExpired && !error && (
            <p className="admin-login__notice" role="status">
              <AdminIcon name="alert" size={16} />
              <span>Your session expired. Please sign in again.</span>
            </p>
          )}

          {error && (
            <p className="admin-login__error" role="alert">
              <AdminIcon name="alert" size={16} />
              <span>{error}</span>
            </p>
          )}

          <form className="admin-login__form" onSubmit={handleLogin}>
            <div className="admin-field">
              <label className="admin-field__label" htmlFor="admin-id">
                Admin ID or official email
              </label>
              <input
                id="admin-id"
                ref={identifierRef}
                className="admin-input"
                type="text"
                placeholder="admin-demo"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                spellCheck={false}
                disabled={locked}
                required
              />
            </div>

            <div className="admin-field">
              <label className="admin-field__label" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                className="admin-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={locked}
                required
              />
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn--primary admin-btn--block"
              disabled={busy !== null || locked}
            >
              {busy === 'credentials' ? (
                <>
                  <span className="admin-login__spinner" aria-hidden="true" />
                  <span>Signing in&hellip;</span>
                </>
              ) : locked ? (
                <span>Locked for {lockSeconds}s</span>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

          {/* ----------------------------------------------------------
              Demo affordances, fenced off from the real form — and absent
              entirely in production. A "skip sign-in" control on a live
              city command centre is not a shortcut, it is an open door,
              so it is not rendered rather than merely disabled.
              ---------------------------------------------------------- */}
          {showDemoZone && (
          <section className="admin-login__demo-zone">
            <p className="admin-login__demo-head">
              <span className="admin-login__demo-chip">Demo mode</span>
              <span>This build runs on sample data with a fixed demo account.</span>
            </p>

            <button
              type="button"
              className="admin-login__demo"
              onClick={handleQuickDemo}
              disabled={busy !== null}
            >
              <span className="admin-login__demo-avatar" aria-hidden="true">
                RA
              </span>
              <span className="admin-login__demo-text">
                <span className="admin-login__demo-name">Quick demo &mdash; skip sign-in</span>
                <span className="admin-login__demo-role">
                  Opens as {demoAccount.displayName}, City Administrator
                </span>
              </span>
              <span className="admin-login__demo-go" aria-hidden="true">
                {busy === 'demo' ? (
                  <span className="admin-login__spinner" />
                ) : (
                  <AdminIcon name="arrow-right" size={16} />
                )}
              </span>
            </button>

            <button
              type="button"
              className="admin-login__demo-toggle"
              aria-expanded={showDemoAccounts}
              onClick={() => setShowDemoAccounts((v) => !v)}
            >
              {showDemoAccounts ? 'Hide demo credentials' : 'Show demo credentials'}
            </button>

            {showDemoAccounts && (
              <dl className="admin-login__demo-creds">
                <div>
                  <dt>Admin ID</dt>
                  <dd>{demoAccount.aliases[0]}</dd>
                </div>
                <div>
                  <dt>Password</dt>
                  <dd>{DEMO_PASSWORD_HINT}</dd>
                </div>
              </dl>
            )}
          </section>
          )}

          <footer className="admin-login__foot">
            <Link to="/department/login">Department staff sign-in</Link>
            <span aria-hidden="true">&middot;</span>
            <Link to="/">Back to JAN-SEVA</Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
