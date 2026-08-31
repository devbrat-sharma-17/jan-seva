// ============================================================
// Admin Command Centre — sign-in
// ============================================================

import React, { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginAdminUser, loginAdminQuickDemo } from '../../services/authService';
import { BrandHomeLink } from '../ui/BrandHomeLink';
import { BrandMark } from '../ui/BrandMark';
import { AdminIcon } from './AdminIcon';
import './AdminLogin.css';

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your admin ID or email.');
      emailRef.current?.focus();
      return;
    }
    setBusy('credentials');
    setError('');
    try {
      await loginAdminUser(email, password);
      navigate('/admin/dashboard');
    } catch {
      setError('Those credentials were not recognised.');
      setBusy(null);
    }
  };

  const handleQuickDemo = () => {
    setBusy('demo');
    // Clear stale seed data so freshly filed complaints appear.
    try {
      localStorage.removeItem('jan_seva_complaints_v3');
    } catch {
      /* storage unavailable — the demo still opens */
    }
    loginAdminQuickDemo();
    navigate('/admin/dashboard');
  };

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
              For municipal administrators overseeing wards, departments and escalations.
            </p>
          </header>

          {error && (
            <p className="admin-login__error" role="alert">
              <AdminIcon name="alert" size={16} />
              <span>{error}</span>
            </p>
          )}

          {/* The demo persona is how this build is actually entered, so it
              leads rather than sitting below the fold. */}
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
              <span className="admin-login__demo-name">Dr. Rakesh Agrawal</span>
              <span className="admin-login__demo-role">City Administrator, Gwalior</span>
            </span>
            <span className="admin-login__demo-go" aria-hidden="true">
              {busy === 'demo' ? (
                <span className="admin-login__spinner" />
              ) : (
                <AdminIcon name="arrow-right" size={16} />
              )}
            </span>
          </button>

          <div className="admin-login__or">
            <span>or sign in with credentials</span>
          </div>

          <form className="admin-login__form" onSubmit={handleLogin}>
            <div className="admin-field">
              <label className="admin-field__label" htmlFor="admin-email">
                Admin ID or email
              </label>
              <input
                id="admin-email"
                ref={emailRef}
                className="admin-input"
                type="text"
                placeholder="admin@gwalior.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                spellCheck={false}
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
              />
              <span className="admin-field__hint">
                Demonstration build — passwords are not checked against a directory.
              </span>
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn--primary admin-btn--block"
              disabled={busy !== null}
            >
              {busy === 'credentials' ? (
                <>
                  <span className="admin-login__spinner" aria-hidden="true" />
                  <span>Signing in&hellip;</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

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
