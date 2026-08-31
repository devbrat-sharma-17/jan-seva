import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { getCurrentDepartmentUser, logoutDepartmentUser, loginWithQuickPersona } from '../../services/authService';
import { getDepartmentConfig } from '../../data/departments';
import { getDepartmentMetrics, subscribeToComplaints } from '../../services/complaintService';
import { BrandHomeLink } from '../ui/BrandHomeLink';
import type { DepartmentUser, DepartmentMetrics } from '../../types/department';
import './DepartmentLayout.css';

interface DepartmentLayoutProps {
  children?: React.ReactNode;
}

type BadgeVariant = 'accent' | 'warning' | 'danger';

interface NavItem {
  to: string;
  label: string;
  /** Bottom-bar caption. Full labels overflowed a 360px viewport. */
  shortLabel: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: BadgeVariant;
}

export function DepartmentLayout({ children }: DepartmentLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [metrics, setMetrics] = useState<DepartmentMetrics | null>(null);

  // Demo convenience: land on any portal route without a session and a
  // nodal-officer session is opened rather than bouncing to the login.
  useEffect(() => {
    if (!getCurrentDepartmentUser()) {
      setUser(loginWithQuickPersona('roads', 'nodal'));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const update = () => setMetrics(getDepartmentMetrics(user.departmentId));
    update();
    const unsubscribe = subscribeToComplaints(update);
    return () => unsubscribe();
  }, [user?.departmentId]);

  if (!user) return null;

  const deptConfig = getDepartmentConfig(user.departmentId);

  const handleLogout = () => {
    logoutDepartmentUser();
    navigate('/department/login');
  };

  const initials = user.name
    .replace(/^(Er\.|Dr\.)\s*/, '')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  const navItems: NavItem[] = [
    {
      to: '/department/dashboard',
      label: 'Dashboard',
      shortLabel: 'Home',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      to: '/department/complaints',
      label: 'Complaint queue',
      shortLabel: 'Queue',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      badge: metrics?.pending ? String(metrics.pending) : undefined,
      badgeVariant: 'warning',
    },
    {
      to: '/department/my-work',
      label: 'My work',
      shortLabel: 'My work',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="m9 14 2 2 4-4" />
        </svg>
      ),
    },
    {
      to: '/department/map',
      label: 'City map',
      shortLabel: 'Map',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      ),
    },
    {
      to: '/department/escalations',
      label: 'Escalations',
      shortLabel: 'Alerts',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      badge: metrics?.escalated ? String(metrics.escalated) : undefined,
      badgeVariant: 'danger',
    },
    {
      to: '/department/performance',
      label: 'Performance',
      shortLabel: 'Score',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
      ),
    },
  ];

  const isCurrent = (to: string) =>
    location.pathname === to || (to !== '/department/dashboard' && location.pathname.startsWith(to));

  return (
    <div
      className="dept-shell"
      style={
        {
          '--dept-accent': deptConfig.visual.accent,
          '--dept-accent-light': deptConfig.visual.accentLight,
          '--dept-accent-bg': deptConfig.visual.accentBg,
          '--dept-accent-glow': deptConfig.visual.accentGlow,
        } as React.CSSProperties
      }
    >
      <a href="#dept-main" className="dept-skip-link">Skip to content</a>

      <header className="dept-header">
        <div className="dept-header__inner">
          <div className="dept-header__brand-group">
            <BrandHomeLink sub="Operations" size="sm" />

            <span className="dept-header__dept-badge">
              <span className="dept-header__dept-dot" aria-hidden="true" />
              <span className="dept-header__dept-name">{deptConfig.shortName}</span>
            </span>
          </div>

          <div className="dept-header__right">
            <div className="dept-user-chip">
              <span className="dept-user-avatar" aria-hidden="true">{initials}</span>
              <span className="dept-user-info">
                <span className="dept-user-name">{user.name}</span>
                <span className="dept-user-role">{user.roleTitle}</span>
              </span>
            </div>

            <button
              type="button"
              className="dept-logout-btn"
              onClick={handleLogout}
              title="Sign out of the department portal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="dept-logout-btn__text">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="dept-main-wrapper">
        <aside className="dept-sidebar">
          <nav className="dept-nav-list" aria-label="Department sections">
            {navItems.map((item) => {
              const active = isCurrent(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`dept-nav-link${active ? ' dept-nav-link--active' : ''}`}
                >
                  <span className="dept-nav-link__icon" aria-hidden="true">{item.icon}</span>
                  <span className="dept-nav-link__label">{item.label}</span>
                  {item.badge && (
                    <span className={`dept-nav-badge dept-nav-badge--${item.badgeVariant ?? 'accent'}`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="dept-sidebar-footer">
            <div className="dept-sidebar-meta">
              <span>Division</span>
              <strong>{user.division}</strong>
            </div>
            <div className="dept-sidebar-meta">
              <span>Control helpline</span>
              <strong>{deptConfig.helpline}</strong>
            </div>
          </div>
        </aside>

        <main className="dept-content" id="dept-main">
          {children || <Outlet />}
        </main>
      </div>

      <nav className="dept-mobile-nav" aria-label="Department sections">
        {navItems.slice(0, 5).map((item) => {
          const active = isCurrent(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`dept-mobile-link${active ? ' dept-mobile-link--active' : ''}`}
            >
              <span className="dept-mobile-link__icon" aria-hidden="true">
                {item.icon}
                {item.badge && <span className={`dept-mobile-dot dept-mobile-dot--${item.badgeVariant ?? 'accent'}`} />}
              </span>
              <span className="dept-mobile-link__label">{item.shortLabel}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
