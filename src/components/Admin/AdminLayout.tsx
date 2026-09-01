// ============================================================
// Admin Command Centre — shell
// ============================================================

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { getCurrentAdminUser } from '../../services/authService';
import {
  getUnreadNotificationCount,
  subscribeToNotificationReadState,
} from '../../services/notificationService';
import { subscribeToComplaints } from '../../services/complaintService';
import { BrandHomeLink } from '../ui/BrandHomeLink';
import { PortalUserMenu } from '../portal/PortalUserMenu';
import { NetworkBanner, NetworkStatusIndicator } from '../portal/NetworkStatus';
import { SessionWarning } from '../portal/SessionWarning';
import { ErrorBoundary } from '../portal/ErrorBoundary';
import { AdminIcon, type AdminIconName } from './AdminIcon';
import type { AdminUser } from '../../types/admin';
import './AdminLayout.css';

interface NavItem {
  path: string;
  icon: AdminIconName;
  label: string;
  /** Bottom-bar caption; full labels do not fit at 360px. */
  short: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/admin/dashboard', icon: 'overview', label: 'Overview', short: 'Home' },
  { path: '/admin/complaints', icon: 'complaints', label: 'Complaints', short: 'Issues' },
  { path: '/admin/departments', icon: 'departments', label: 'Departments', short: 'Depts' },
  { path: '/admin/map', icon: 'map', label: 'Civic map', short: 'Map' },
  { path: '/admin/escalations', icon: 'escalations', label: 'Escalations', short: 'Alerts' },
  { path: '/admin/feedback', icon: 'feedback', label: 'Citizen feedback', short: 'Feedback' },
  { path: '/admin/performance', icon: 'performance', label: 'Performance', short: 'Score' },
  { path: '/admin/assets', icon: 'map', label: 'Asset ledger', short: 'Assets' },
  { path: '/admin/wards', icon: 'departments', label: 'Ward reality', short: 'Wards' },
  { path: '/admin/open-data', icon: 'reports', label: 'Open data', short: 'Data' },
  { path: '/admin/initiatives', icon: 'initiatives', label: 'Initiatives', short: 'Projects' },
  { path: '/admin/reports', icon: 'reports', label: 'Reports', short: 'Reports' },
];

const BOTTOM_NAV_ITEMS = NAV_ITEMS.slice(0, 5);

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<AdminUser | null>(() => getCurrentAdminUser());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifCount, setNotifCount] = useState(0);

  // The route guard has already established the session; this only reads
  // the profile that goes with it.
  useEffect(() => {
    setUser(getCurrentAdminUser());
  }, [location.pathname]);

  /* The unread count used to be recomputed inside render, which walked
     every complaint in the store on every keystroke in the search box.
     It is derived once and refreshed when the records actually change. */
  useEffect(() => {
    const refresh = () => setNotifCount(getUnreadNotificationCount());
    refresh();

    // Two things move this number: the records the alerts derive from,
    // and the read markers. Without the second, marking an alert read
    // left the badge showing it until a complaint happened to change.
    const unsubRecords = subscribeToComplaints(refresh);
    const unsubRead = subscribeToNotificationReadState(refresh);
    return () => {
      unsubRecords();
      unsubRead();
    };
  }, []);

  // A route change means the drawer has done its job.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Escape closes the drawer, and the page behind it stops scrolling.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/admin/complaints?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  if (!user) return null;

  const isCurrent = (path: string) =>
    location.pathname === path ||
    (path === '/admin/dashboard' && location.pathname === '/admin') ||
    (path !== '/admin/dashboard' && location.pathname.startsWith(path));

  return (
    <div className="admin-layout">
      <a href="#admin-main" className="admin-skip-link">
        Skip to content
      </a>

      <div className="admin-layout__notices">
        <SessionWarning />
        <NetworkBanner />
      </div>

      {drawerOpen && (
        <div className="admin-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      {/* ---------- Sidebar ---------- */}
      <aside className={`admin-sidebar${drawerOpen ? ' is-open' : ''}`}>
        <div className="admin-sidebar__brand">
          {/* The mark goes to the public site — it is the product's front
              door, not a shortcut to this section's dashboard. */}
          <BrandHomeLink sub="Admin" tone="onDark" size="sm" />

          <button
            type="button"
            className="admin-sidebar__close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          >
            <AdminIcon name="close" size={20} />
          </button>
        </div>

        <nav className="admin-sidebar__nav" aria-label="Admin sections">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              aria-current={isCurrent(item.path) ? 'page' : undefined}
              className={`admin-navlink${isCurrent(item.path) ? ' admin-navlink--active' : ''}`}
            >
              <span className="admin-navlink__icon">
                <AdminIcon name={item.icon} size={18} />
              </span>
              <span className="admin-navlink__label">{item.label}</span>
              {item.path === '/admin/escalations' && notifCount > 0 && (
                <span className="admin-navlink__badge">{notifCount > 9 ? '9+' : notifCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar__foot">
          <p className="admin-sidebar__note">
            Authorised personnel only. Citizen identifiers are shown masked.
          </p>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-topbar__menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <AdminIcon name="menu" size={20} />
          </button>

          <form className="admin-search" onSubmit={handleSearch} role="search">
            <AdminIcon name="search" size={16} />
            <input
              className="admin-search__input"
              type="search"
              placeholder="Search complaints and departments"
              aria-label="Search complaints and departments"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className="admin-topbar__right">
            <span className="admin-topbar__demo" title="Every figure in this build is sample data">
              Demo data
            </span>

            <NetworkStatusIndicator />

            <button
              type="button"
              className="admin-topbar__notif"
              aria-label={`${notifCount} unread alerts`}
              onClick={() => navigate('/admin/escalations')}
            >
              <AdminIcon name="bell" size={19} />
              {notifCount > 0 && (
                <span className="admin-topbar__notif-dot">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            <PortalUserMenu
              name={user.name}
              roleTitle={user.roleTitle}
              scope={`${user.city} · city-wide access`}
              signInPath="/admin/login"
            />
          </div>
        </header>

        <main className="admin-content" id="admin-main">
          {/* A failing chart or map leaves the navigation intact. */}
          <ErrorBoundary area="this section" variant="page">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* ---------- Bottom bar (<1025px) ---------- */}
      <nav className="admin-bottomnav" aria-label="Admin sections">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            aria-current={isCurrent(item.path) ? 'page' : undefined}
            className={`admin-bottomlink${isCurrent(item.path) ? ' admin-bottomlink--active' : ''}`}
          >
            <span className="admin-bottomlink__icon">
              <AdminIcon name={item.icon} size={20} />
              {item.path === '/admin/escalations' && notifCount > 0 && (
                <span className="admin-bottomlink__dot" />
              )}
            </span>
            <span className="admin-bottomlink__label">{item.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
