// ============================================================
// Department Operations — sign-in
// ============================================================
// A department ID and password are required. The role cards that used to
// sign people in on one tap now only *select* a role: they fill the ID
// field, and the password is still yours to enter. Quick Demo remains,
// clearly fenced and labelled.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginDepartment, startDepartmentDemoSession } from '../../services/authService';
import { getThrottleState } from '../../services/loginThrottle';
import { DEMO_PASSWORD_HINT } from '../../data/demoDirectory';
import { demoAccountsAllowed } from '../../config/appMode';
import { DEPARTMENTS, getAllDepartments } from '../../data/departments';
import type { DepartmentId, DepartmentRole } from '../../types/department';
import { BrandMark } from '../ui/BrandMark';
import { BrandHomeLink } from '../ui/BrandHomeLink';
import './DepartmentLogin.css';

/** The three portal roles, in the order they appear on the card. */
const ROLES: Array<{ id: DepartmentRole; label: string; blurb: string }> = [
  { id: 'nodal', label: 'Nodal Officer', blurb: 'Triage and assign incoming reports' },
  { id: 'field', label: 'Field Officer', blurb: 'Work your queue and submit evidence' },
  { id: 'head', label: 'Department Head', blurb: 'Performance, SLA and escalations' },
];

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function DepartmentLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const departments = useMemo(() => getAllDepartments(), []);

  const [selectedDeptId, setSelectedDeptId] = useState<DepartmentId>('roads');
  const [selectedRole, setSelectedRole] = useState<DepartmentRole>('nodal');
  const [identifier, setIdentifier] = useState('PWD-001');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [showDemo, setShowDemo] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const identifierRef = useRef<HTMLInputElement>(null);

  const currentDept = DEPARTMENTS[selectedDeptId] ?? DEPARTMENTS.roads;

  const returnTo = searchParams.get('from') || '/department/dashboard';
  const wasExpired = searchParams.get('reason') === 'expired';

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = setInterval(() => {
      const state = getThrottleState(identifier);
      setLockSeconds(state.secondsRemaining);
      if (!state.locked) setError(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockSeconds, identifier]);

  /** Staff record the chosen department/role pair resolves to. */
  const staffFor = (deptId: DepartmentId, role: DepartmentRole) => {
    const dept = DEPARTMENTS[deptId] ?? DEPARTMENTS.roads;
    return dept.mockStaff.find((s) => s.role === role) ?? dept.mockStaff[0];
  };

  const activeStaff = staffFor(selectedDeptId, selectedRole);

  /* Department, role and the ID field are three views of one decision, so
     changing any of them re-syncs the others. */
  const selectDepartment = (deptId: DepartmentId) => {
    setSelectedDeptId(deptId);
    setIdentifier(staffFor(deptId, selectedRole).id);
    setError(null);
  };

  const selectRole = (role: DepartmentRole) => {
    setSelectedRole(role);
    setIdentifier(staffFor(selectedDeptId, role).id);
    setError(null);
    // The ID is filled in; the password is the part still owed.
    passwordRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('credentials');
    setError(null);

    const result = await loginDepartment({ identifier, password }, selectedDeptId);

    if (result.ok) {
      setPassword('');
      navigate(returnTo, { replace: true });
      return;
    }

    setBusy(null);
    setError(result.message);
    setLockSeconds(result.secondsRemaining ?? 0);
    setPassword('');
    if (result.reason === 'missing_fields') identifierRef.current?.focus();
  };

  const handleQuickDemo = () => {
    setBusy('demo');
    startDepartmentDemoSession(selectedDeptId, selectedRole);
    navigate(returnTo, { replace: true });
  };

  const locked = lockSeconds > 0;

  return (
    <div
      className="deptlogin"
      style={
        {
          '--dept-accent': currentDept.visual.accent,
          '--dept-accent-light': currentDept.visual.accentLight,
          '--dept-accent-bg': currentDept.visual.accentBg,
          '--dept-accent-glow': currentDept.visual.accentGlow,
        } as React.CSSProperties
      }
    >
      {/* ---- Context panel. Desktop only: on a phone it would push the
           form below the fold for no operational gain. ---- */}
      <aside className="deptlogin__aside">
        <div className="deptlogin__aside-inner">
          <BrandHomeLink tone="onDark" size="md" />

          <p className="deptlogin__aside-lede">
            The operations desk behind every civic complaint filed in Gwalior.
          </p>

          <ul className="deptlogin__aside-list">
            <li>Triage incoming reports by assessed severity and SLA risk</li>
            <li>Assign crews, log site progress and file resolution evidence</li>
            <li>Track escalations and your department&rsquo;s performance score</li>
          </ul>

          <div className="deptlogin__aside-foot">
            <span className="deptlogin__aside-dept">{currentDept.name}</span>
            <span className="deptlogin__aside-help">Control helpline {currentDept.helpline}</span>
          </div>
        </div>
      </aside>

      {/* ---- Auth card ---- */}
      <main className="deptlogin__main">
        <div className="deptlogin__card">
          <header className="deptlogin__head">
            <span className="deptlogin__brand">
              <BrandMark size={22} />
              <span className="deptlogin__brand-name">JAN-SEVA</span>
              <span className="deptlogin__brand-tag">Operations</span>
            </span>
            <h1 className="deptlogin__title">Department sign-in</h1>
            <p className="deptlogin__subtitle">
              Authorised department staff only.
            </p>
          </header>

          {wasExpired && !error && (
            <p className="dept-alert dept-alert--warning" role="status">
              <span>Your session expired. Please sign in again.</span>
            </p>
          )}

          {error && (
            <p className="dept-alert dept-alert--error" role="alert">
              <span>{error}</span>
            </p>
          )}

          {/* Step 1 — department. */}
          <section className="deptlogin__step">
            <h2 className="deptlogin__step-label" id="deptlogin-dept-label">
              <span className="deptlogin__step-num">1</span>
              Your department
            </h2>

            <div className="deptlogin__depts" role="group" aria-labelledby="deptlogin-dept-label">
              {departments.map((d) => {
                const active = selectedDeptId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={active}
                    className={`deptlogin__dept${active ? ' is-active' : ''}`}
                    style={{ '--chip-accent': d.visual.accent } as React.CSSProperties}
                    onClick={() => selectDepartment(d.id)}
                  >
                    <span className="deptlogin__dept-dot" aria-hidden="true" />
                    <span className="deptlogin__dept-name">{d.shortName}</span>
                  </button>
                );
              })}
            </div>

            <p className="deptlogin__dept-meta">{currentDept.name}</p>
          </section>

          {/* Step 2 — role. Selecting one fills the ID; it does not sign
              anybody in on its own. */}
          <section className="deptlogin__step">
            <h2 className="deptlogin__step-label" id="deptlogin-role-label">
              <span className="deptlogin__step-num">2</span>
              Your role
            </h2>

            <div className="deptlogin__roles" role="group" aria-labelledby="deptlogin-role-label">
              {ROLES.map((role) => {
                const staff = staffFor(selectedDeptId, role.id);
                const selected = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={selected}
                    className={`deptlogin__role${selected ? ' is-selected' : ''}`}
                    onClick={() => selectRole(role.id)}
                  >
                    <span className="deptlogin__role-avatar" aria-hidden="true">
                      {staff.name
                        .replace(/^(Er\.|Dr\.)\s*/, '')
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>

                    <span className="deptlogin__role-text">
                      <span className="deptlogin__role-title">{role.label}</span>
                      <span className="deptlogin__role-name">{staff.id}</span>
                      <span className="deptlogin__role-blurb">{role.blurb}</span>
                    </span>

                    <span className="deptlogin__role-go" aria-hidden="true">
                      {selected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 3 — credentials. */}
          <section className="deptlogin__step">
            <h2 className="deptlogin__step-label" id="deptlogin-creds-label">
              <span className="deptlogin__step-num">3</span>
              Sign in
            </h2>

            <form className="deptlogin__form" onSubmit={handleSubmit} aria-labelledby="deptlogin-creds-label">
              <div className="dept-field">
                <label className="dept-field__label" htmlFor="deptlogin-id">
                  Department ID or staff email
                </label>
                <input
                  id="deptlogin-id"
                  ref={identifierRef}
                  type="text"
                  className="dept-input"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  // A demo staff ID makes a helpful placeholder in the
                  // prototype, and prints a demo credential on a real
                  // sign-in form in production.
                  placeholder={demoAccountsAllowed() ? activeStaff.id : 'Department ID'}
                  autoComplete="username"
                  spellCheck={false}
                  disabled={locked}
                  required
                />
              </div>

              <div className="dept-field">
                <label className="dept-field__label" htmlFor="deptlogin-pw">
                  Password
                </label>
                <input
                  id="deptlogin-pw"
                  ref={passwordRef}
                  type="password"
                  className="dept-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={locked}
                  required
                />
              </div>

              <button
                type="submit"
                className="dept-action-btn dept-action-btn--primary dept-action-btn--block"
                disabled={busy !== null || locked}
              >
                {busy === 'credentials' ? (
                  <>
                    <span className="deptlogin__spinner" aria-hidden="true" />
                    <span>Signing in&hellip;</span>
                  </>
                ) : locked ? (
                  <span>Locked for {lockSeconds}s</span>
                ) : (
                  <>
                    <span>Sign in to {currentDept.shortName}</span>
                    <ArrowIcon />
                  </>
                )}
              </button>
            </form>
          </section>

          {/* ----------------------------------------------------------
              Demo affordances, fenced off from the form above — and not
              rendered at all in production. See AdminLogin for why this
              is removal rather than a disabled state.
              ---------------------------------------------------------- */}
          {demoAccountsAllowed() && (
          <section className="deptlogin__demo-zone">
            <p className="deptlogin__demo-head">
              <span className="deptlogin__demo-chip">Demo mode</span>
              <span>Sample data only. No real municipal records are shown.</span>
            </p>

            <button
              type="button"
              className="deptlogin__demo-btn"
              onClick={handleQuickDemo}
              disabled={busy !== null}
            >
              {busy === 'demo'
                ? 'Opening…'
                : `Quick demo — open as ${activeStaff.roleTitle}, ${currentDept.shortName}`}
            </button>

            <button
              type="button"
              className="deptlogin__demo-toggle"
              aria-expanded={showDemo}
              onClick={() => setShowDemo((v) => !v)}
            >
              {showDemo ? 'Hide demo credentials' : 'Show demo credentials'}
            </button>

            {showDemo && (
              <dl className="deptlogin__demo-creds">
                <div>
                  <dt>ID</dt>
                  <dd>{activeStaff.id}</dd>
                </div>
                <div>
                  <dt>Password</dt>
                  <dd>{DEMO_PASSWORD_HINT}</dd>
                </div>
              </dl>
            )}
          </section>
          )}

          <footer className="deptlogin__foot">
            Reporting as a resident?{' '}
            <Link to="/track">Track a complaint</Link> or <Link to="/report">report an issue</Link>.
          </footer>
        </div>
      </main>
    </div>
  );
}
