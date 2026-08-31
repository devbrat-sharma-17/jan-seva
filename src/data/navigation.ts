import type { NavLink, PortalCard } from '../types';

/**
 * Primary navigation — the four things a citizen comes here to do.
 *
 * "About Us" and "Help" used to sit here too, but six nowrap links need
 * ~590px and the header only ever has ~415px of centre track (the bar is
 * capped at the 1200px content width, so a wider monitor gives it nothing).
 * They were also duplicated verbatim in the footer. They now live in
 * `secondaryNavLinks`: still in the drawer, still in the footer, out of the
 * bar where they were overflowing onto the city selector.
 */
export const mainNavLinks: NavLink[] = [
  { label: 'Home', href: '/', priority: 1 },
  { label: 'How It Works', href: '/#how-it-works', priority: 1 },
  { label: 'Track Complaint', href: '/track', priority: 1 },
  { label: 'Initiatives', href: '/initiatives', priority: 2 },
];

/** Informational pages. Drawer and footer only — never the header bar. */
export const secondaryNavLinks: NavLink[] = [
  { label: 'About Us', href: '/about' },
  { label: 'Help', href: '/help' },
];

export const portalLinks: PortalCard[] = [
  {
    id: 'admin',
    title: 'Admin Login',
    subtitle: 'Secure Admin Portal',
    icon: 'admin',
    href: '/admin/login',
  },
  {
    id: 'department',
    title: 'Department Login',
    subtitle: 'Department Portal',
    icon: 'department',
    href: '/department/login',
  },
];

export const footerQuickLinks: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Initiatives', href: '/initiatives' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Track Complaint', href: '/track' },
];

export const footerImportantLinks: NavLink[] = [
  { label: 'About Us', href: '/about' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Help', href: '/help' },
  { label: 'Contact', href: '/contact' },
];
