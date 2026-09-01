import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { getCurrentDepartmentUser } from '../../services/authService';
import { getDepartmentConfig } from '../../data/departments';
import { getDepartmentMetrics, subscribeToComplaints } from '../../services/complaintService';
import { BrandHomeLink } from '../ui/BrandHomeLink';
import { PortalUserMenu } from '../portal/PortalUserMenu';
import { NetworkBanner, NetworkStatusIndicator } from '../portal/NetworkStatus';
import { SessionWarning } from '../portal/SessionWarning';
import { ErrorBoundary } from '../portal/ErrorBoundary';
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

const ICONS = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  queue: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  myWork: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  ),
  map: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  alerts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  score: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),
};

export function DepartmentLayout({ children }: DepartmentLayoutProps) {
  const location = useLocation();
  const [user, setUser] = useState<DepartmentUser | null>(() => getCurrentDepartmentUser());
  const [metrics, setMetrics] = useState<DepartmentMetrics | null>(null);

  // No auto-sign-in. Reaching this shell means the route guard already
  // found a valid department session; if it somehow did not, the guard
  // redirects rather than this layout inventing a persona.
  useEffect(() => {
    setUser(getCurrentDepartmentUser());
  }, [location.pathname]);

  const departmentId = user?.departmentId;

  useEffect(() => {
    if (!departmentId) return;
    const update = () => setMetrics(getDepartmentMetrics(departmentId));
    update();
    return subscribeToComplaints(update);
  }, [departmentId]);

  const isFieldOfficer = user?.role === 'field';

  /* Nav is rebuilt only when the badge counts or the role actually
     change — six inline SVG trees per keystroke was measurable on a
     mid-range phone. */
  const navItems = useMemo<NavItem[]>(() => {
    const dashboard: NavItem = {
      to: '/department/dashboard',
      label: 'Dashboard',
      shortLabel: 'Home',
      icon: ICONS.dashboard,
    };

    const myWork: NavItem = {
      to: '/department/my-work',
      label: 'My work',
      shortLabel: 'My work',
      icon: ICONS.myWork,
    };

    const queue: NavItem = {
      to: '/department/complaints',
      label: 'Complaint queue',
      shortLabel: 'Queue',
      icon: ICONS.queue,
      badge: metrics?.pending ? String(metrics.pending) : undefined,
      badgeVariant: 'warning',
    };

    /* The Work Card sits directly under "My work" because it IS the
       officer's day, routed. Burying a field tool under Map or
       Performance would put it where a field officer never looks. */
    const workCard: NavItem = {
      to: '/department/work-card',
      label: 'Work card',
      shortLabel: 'Route',
      icon: ICONS.map,
    };

    const rest: NavItem[] = [
      { to: '/department/map', label: 'City map', shortLabel: 'Map', icon: ICONS.map },
      {
        to: '/department/escalations',
        label: 'Escalations',
        shortLabel: 'Alerts',
        icon: ICONS.alerts,
        badge: metrics?.escalated ? String(metrics.escalated) : undefined,
        badgeVariant: 'danger',
      },
      { to: '/department/performance', label: 'Performance', shortLabel: 'Score', icon: ICONS.score },
    ];

    // A field officer's day is their own task list, not the department's
    // triage board, so their queue leads and the dashboard follows.
    return isFieldOfficer
      ? [myWork, workCard, dashboard, queue, ...rest]
      : [dashboard, queue, myWork, workCard, ...rest];
  }, [metrics?.pending, metrics?.escalated, isFieldOfficer]);

  if (!user) return null;

  const deptConfig = getDepartmentConfig(user.departmentId);

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

      <SessionWarning />
      <NetworkBanner />

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
            <NetworkStatusIndicator />

            <PortalUserMenu
              name={user.name}
              roleTitle={user.roleTitle}
              scope={`${deptConfig.name} · ${user.division}`}
              signInPath="/department/login"
            />
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
            <p className="dept-sidebar-note">
              Authorised personnel only. Records are limited to {deptConfig.shortName}.
            </p>
          </div>
        </aside>

        <main className="dept-content" id="dept-main">
          {/* One failing screen must not take the navigation with it. */}
          <ErrorBoundary area="this section" variant="page">
            {children || <Outlet />}
          </ErrorBoundary>
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
