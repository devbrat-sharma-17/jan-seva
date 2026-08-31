import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginDepartmentUser, loginWithQuickPersona } from '../../services/authService';
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

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function DepartmentLogin() {
  const navigate = useNavigate();
  const departments = useMemo(() => getAllDepartments(), []);

  const [selectedDeptId, setSelectedDeptId] = useState<DepartmentId>('roads');
  const [selectedRole, setSelectedRole] = useState<DepartmentRole>('nodal');
  const [identifier, setIdentifier] = useState('PWD-001');
  const [password, setPassword] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);
  /** Which control is mid-flight, so only that button shows a spinner. */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const identifierRef = useRef<HTMLInputElement>(null);

  const currentDept = DEPARTMENTS[selectedDeptId] ?? DEPARTMENTS.roads;

  /** Staff record the chosen department/role pair resolves to. */
  const staffFor = (deptId: DepartmentId, role: DepartmentRole) => {
    const dept = DEPARTMENTS[deptId] ?? DEPARTMENTS.roads;
    return dept.mockStaff.find((s) => s.role === role) ?? dept.mockStaff[0];
  };

  const activeStaff = staffFor(selectedDeptId, selectedRole);

  /* The department chip, the role card and the credentials field are three
     views of one decision, so changing any of them re-syncs the others. */
  const selectDepartment = (deptId: DepartmentId) => {
    setSelectedDeptId(deptId);
    setIdentifier(staffFor(deptId, selectedRole).id);
    setError(null);
  };

  const selectRole = (role: DepartmentRole) => {
    setSelectedRole(role);
    setIdentifier(staffFor(selectedDeptId, role).id);
    setError(null);
  };

  const handleRoleSignIn = (role: DepartmentRole) => {
    selectRole(role);
    setBusy(role);
    setError(null);
    try {
      loginWithQuickPersona(selectedDeptId, role);
      navigate('/department/dashboard');
    } catch {
      setError('Could not open a session for that role. Please try again.');
      setBusy(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Enter your department ID or staff email.');
      identifierRef.current?.focus();
      return;
    }

    setBusy('credentials');
    setError(null);
    try {
      await loginDepartmentUser(selectedDeptId, identifier, password);
      navigate('/department/dashboard');
    } catch {
      setError('Those credentials were not recognised for this department.');
      setBusy(null);
    }
  };

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
            <li>Triage incoming reports by AI severity and SLA risk</li>
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
              Gwalior Municipal Corporation &middot; civic issue triage and field operations.
            </p>
          </header>

          {error && (
            <p className="dept-alert dept-alert--error" role="alert">
              <span>{error}</span>
            </p>
          )}

          {/* Step 1 — department. One control, one row, no wrapping. */}
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

          {/* Step 2 — role. This is the primary way in, so it gets the
              full-width targets and the real officer names. */}
          <section className="deptlogin__step">
            <h2 className="deptlogin__step-label" id="deptlogin-role-label">
              <span className="deptlogin__step-num">2</span>
              Continue as
            </h2>

            <div className="deptlogin__roles" aria-labelledby="deptlogin-role-label">
              {ROLES.map((role) => {
                const staff = staffFor(selectedDeptId, role.id);
                const isBusy = busy === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={`deptlogin__role${selectedRole === role.id ? ' is-selected' : ''}`}
                    onClick={() => handleRoleSignIn(role.id)}
                    disabled={busy !== null}
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
                      <span className="deptlogin__role-name">{staff.name}</span>
                      <span className="deptlogin__role-blurb">{role.blurb}</span>
                    </span>

                    <span className="deptlogin__role-go" aria-hidden="true">
                      {isBusy ? <span className="deptlogin__spinner" /> : <ArrowIcon />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Secondary path, collapsed by default — the demo almost never
              needs it, and open it doubled the height of the card. */}
          <section className="deptlogin__alt">
            <button
              type="button"
              className="deptlogin__alt-toggle"
              aria-expanded={showCredentials}
              aria-controls="deptlogin-credentials"
              onClick={() => setShowCredentials((v) => !v)}
            >
              <span>Sign in with a staff ID instead</span>
              <span className={`deptlogin__alt-chevron${showCredentials ? ' is-open' : ''}`}>
                <ChevronIcon />
              </span>
            </button>

            <div id="deptlogin-credentials" hidden={!showCredentials}>
              <form className="deptlogin__form" onSubmit={handleSubmit}>
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
                    placeholder={activeStaff.id}
                    autoComplete="username"
                    spellCheck={false}
                  />
                  <span className="dept-field__hint">
                    Signs you in as {activeStaff.name} &middot; {activeStaff.roleTitle}
                  </span>
                </div>

                <div className="dept-field">
                  <label className="dept-field__label" htmlFor="deptlogin-pw">
                    Password
                  </label>
                  <input
                    id="deptlogin-pw"
                    type="password"
                    className="dept-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <span className="dept-field__hint">
                    Demonstration build — passwords are not checked against a directory.
                  </span>
                </div>

                <button
                  type="submit"
                  className="dept-action-btn dept-action-btn--primary dept-action-btn--block"
                  disabled={busy !== null}
                >
                  {busy === 'credentials' ? (
                    <>
                      <span className="deptlogin__spinner" aria-hidden="true" />
                      <span>Signing in&hellip;</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in to {currentDept.shortName}</span>
                      <ArrowIcon />
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>

          <footer className="deptlogin__foot">
            Reporting as a resident?{' '}
            <Link to="/track">Track a complaint</Link> or <Link to="/report">report an issue</Link>.
          </footer>
        </div>
      </main>
    </div>
  );
}
