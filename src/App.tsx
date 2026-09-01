import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { PortalAccess } from './components/PortalAccess/PortalAccess';
import { IssueCategories } from './components/IssueCategories/IssueCategories';
import { HowItWorks } from './components/HowItWorks/HowItWorks';
import { Footer } from './components/Footer/Footer';
import { MobileActionBar } from './components/MobileActionBar/MobileActionBar';
import { PlaceholderPage } from './components/Placeholder/PlaceholderPage';

/* ------------------------------------------------------------
   Code splitting.
   ------------------------------------------------------------
   A citizen filing a pothole report was downloading the entire Command
   Centre — every chart, map and analytics screen — before the first
   paint, on the mobile connection this product is mostly used on. The
   portals are behind a sign-in that citizens never pass, so their code
   has no business in the initial bundle.

   The report wizard and the tracking page are now split too. The
   earlier reasoning — that they are the first paint and deferring them
   would only cost a round trip — was half right: the LANDING PAGE is
   the first paint. `/report` and `/track` are separate navigations, and
   a citizen who never taps either was downloading both.

   The round trip is real, though, so it is paid before it is felt:
   `prefetchCitizenRoutes` below warms both chunks once the browser is
   idle. By the time a thumb reaches the CTA the code is already there.
   ------------------------------------------------------------ */

const importReportWizard = () => import('./components/ReportWizard/ReportWizard');
const importTrackComplaint = () => import('./components/TrackComplaint/TrackComplaint');

const ReportWizard = lazy(() =>
  importReportWizard().then((m) => ({ default: m.ReportWizard }))
);
const TrackComplaint = lazy(() =>
  importTrackComplaint().then((m) => ({ default: m.TrackComplaint }))
);

/**
 * Warms the two chunks a citizen is most likely to need next.
 *
 * Deliberately on idle rather than on mount: the landing page's own
 * paint, hero image and fonts come first. On a device that never goes
 * idle, `setTimeout` still fires — a slow prefetch beats none, and both
 * failures are silent because a failed prefetch costs nothing (the
 * lazy import will simply fetch it again on navigation).
 */
function prefetchCitizenRoutes(): void {
  const warm = () => {
    void importReportWizard().catch(() => {});
    void importTrackComplaint().catch(() => {});
  };

  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;

  if (typeof ric === 'function') ric(warm, { timeout: 3000 });
  else window.setTimeout(warm, 1500);
}

// Department Operations
const DepartmentLogin = lazy(() =>
  import('./components/Department/DepartmentLogin').then((m) => ({ default: m.DepartmentLogin }))
);
const DepartmentLayout = lazy(() =>
  import('./components/Department/DepartmentLayout').then((m) => ({ default: m.DepartmentLayout }))
);
const DepartmentDashboard = lazy(() =>
  import('./components/Department/Dashboard/DepartmentDashboard').then((m) => ({ default: m.DepartmentDashboard }))
);
const DepartmentComplaints = lazy(() =>
  import('./components/Department/Complaints/DepartmentComplaints').then((m) => ({ default: m.DepartmentComplaints }))
);
const ComplaintDetailView = lazy(() =>
  import('./components/Department/Complaints/ComplaintDetailView').then((m) => ({ default: m.ComplaintDetailView }))
);
const MyWorkView = lazy(() =>
  import('./components/Department/MyWork/MyWorkView').then((m) => ({ default: m.MyWorkView }))
);
const DepartmentMap = lazy(() =>
  import('./components/Department/Map/DepartmentMap').then((m) => ({ default: m.DepartmentMap }))
);
const DepartmentEscalations = lazy(() =>
  import('./components/Department/Escalations/DepartmentEscalations').then((m) => ({ default: m.DepartmentEscalations }))
);
const DepartmentPerformance = lazy(() =>
  import('./components/Department/Performance/DepartmentPerformance').then((m) => ({ default: m.DepartmentPerformance }))
);
const WorkCardView = lazy(() =>
  import('./components/Department/WorkCard/WorkCardView').then((m) => ({ default: m.WorkCardView }))
);

// Admin Command Centre
const AdminLogin = lazy(() =>
  import('./components/Admin/AdminLogin').then((m) => ({ default: m.AdminLogin }))
);
const AdminLayout = lazy(() =>
  import('./components/Admin/AdminLayout').then((m) => ({ default: m.AdminLayout }))
);
const AdminDashboard = lazy(() =>
  import('./components/Admin/Dashboard/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const AdminComplaints = lazy(() =>
  import('./components/Admin/Complaints/AdminComplaints').then((m) => ({ default: m.AdminComplaints }))
);
const AdminComplaintDetail = lazy(() =>
  import('./components/Admin/Complaints/AdminComplaintDetail').then((m) => ({ default: m.AdminComplaintDetail }))
);
const DepartmentOverview = lazy(() =>
  import('./components/Admin/Departments/DepartmentOverview').then((m) => ({ default: m.DepartmentOverview }))
);
const DepartmentDetailPage = lazy(() =>
  import('./components/Admin/Departments/DepartmentDetailPage').then((m) => ({ default: m.DepartmentDetailPage }))
);
const AdminCivicMap = lazy(() =>
  import('./components/Admin/Map/AdminCivicMap').then((m) => ({ default: m.AdminCivicMap }))
);
const AdminEscalations = lazy(() =>
  import('./components/Admin/Escalations/AdminEscalations').then((m) => ({ default: m.AdminEscalations }))
);
const FeedbackOverview = lazy(() =>
  import('./components/Admin/Feedback/FeedbackOverview').then((m) => ({ default: m.FeedbackOverview }))
);
const AdminPerformance = lazy(() =>
  import('./components/Admin/Performance/AdminPerformance').then((m) => ({ default: m.AdminPerformance }))
);
const InitiativeManager = lazy(() =>
  import('./components/Admin/Initiatives/InitiativeManager').then((m) => ({ default: m.InitiativeManager }))
);
const AdminReports = lazy(() =>
  import('./components/Admin/Reports/AdminReports').then((m) => ({ default: m.AdminReports }))
);
const AdminAssetLedger = lazy(() =>
  import('./components/Admin/Assets/AdminAssetLedger').then((m) => ({ default: m.AdminAssetLedger }))
);
const AdminWardReality = lazy(() =>
  import('./components/Admin/Wards/AdminWardReality').then((m) => ({ default: m.AdminWardReality }))
);
const AdminOpenData = lazy(() =>
  import('./components/Admin/OpenData/AdminOpenData').then((m) => ({ default: m.AdminOpenData }))
);

/* ------------------------------------------------------------
   Route guards are split too.
   ------------------------------------------------------------
   These were statically imported, and they are the reason the entry
   chunk was still pulling the whole auth graph: ProtectedRoute needs
   the session service, UnauthorizedPage needs authService, and
   authService reaches the department config and the demo credential
   directory. A citizen who never signs in was downloading all of it to
   read the landing page.

   Guards are route *elements*, so deferring them costs nothing: they
   render only when a /department or /admin path is matched, at which
   point the portal chunk is being fetched anyway.
   ------------------------------------------------------------ */
const ProtectedDepartmentRoute = lazy(() =>
  import('./components/auth/ProtectedRoute').then((m) => ({ default: m.ProtectedDepartmentRoute }))
);
const ProtectedAdminRoute = lazy(() =>
  import('./components/auth/ProtectedRoute').then((m) => ({ default: m.ProtectedAdminRoute }))
);
const UnauthorizedPage = lazy(() =>
  import('./components/auth/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage }))
);

import './App.css';

function LandingPage() {
  // Warm the report and tracking chunks while the citizen reads the page.
  useEffect(prefetchCitizenRoutes, []);

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to content</a>

      <Header />

      <main id="main-content">
        <Hero />
        <PortalAccess />
        <IssueCategories />
        <HowItWorks />
      </main>

      <Footer />
      <MobileActionBar />
    </div>
  );
}

/**
 * Routes advertised by the header, footer and portal cards but without a
 * screen behind them yet.
 */
const PLACEHOLDER_ROUTES: Array<{ path: string; title: string; description: string }> = [
  {
    path: '/initiatives',
    title: 'City initiatives',
    description:
      'Ongoing and upcoming civic projects across Gwalior, with their status and timelines. This page is being prepared.',
  },
  {
    path: '/about',
    title: 'About JAN-SEVA',
    description:
      'How this portal works, who runs it, and how complaints reach the departments responsible for them.',
  },
  {
    path: '/help',
    title: 'Help & support',
    description:
      'Guides for filing and tracking a complaint, and how to reach a human if the portal cannot resolve your issue.',
  },
  {
    path: '/privacy',
    title: 'Privacy policy',
    description:
      'What JAN-SEVA collects when you file a complaint, how long it is kept, and who can see it.',
  },
  {
    path: '/city/indore',
    title: 'Indore Portal',
    description:
      'Municipal grievance onboarding and department routing is currently underway with Indore Municipal Corporation (IMC). JAN-SEVA services will launch for Indore in the upcoming release.',
  },
  {
    path: '/city/bhopal',
    title: 'Bhopal Portal',
    description:
      'Municipal grievance onboarding and department routing is currently underway with Bhopal Municipal Corporation (BMC). JAN-SEVA services will launch for Bhopal in the upcoming release.',
  },
  {
    path: '/terms',
    title: 'Terms of service',
    description: 'The terms that apply when you use JAN-SEVA to report a civic issue.',
  },
  {
    path: '/contact',
    title: 'Contact us',
    description:
      'Department helplines and the municipal corporation office address for issues this portal cannot handle.',
  },
];

/**
 * Shown while a portal chunk is fetched. Deliberately quiet: on a warm
 * cache it is on screen for a frame or two, and a spinner that flashes
 * reads as jank rather than progress.
 */
function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/report" element={<ReportWizard />} />
      <Route path="/report-issue" element={<ReportWizard />} />
      <Route path="/track" element={<TrackComplaint />} />

      {/* ----------------------------------------------------------
          Portals. Everything below /department and /admin sits behind a
          guard: no session redirects to that portal's sign-in, and the
          wrong role gets the unauthorized page rather than a screen it
          should not see. The sign-in routes themselves stay open.
          ---------------------------------------------------------- */}

      <Route path="/department/login" element={<DepartmentLogin />} />
      <Route element={<ProtectedDepartmentRoute />}>
        <Route path="/department" element={<DepartmentLayout />}>
          <Route index element={<DepartmentDashboard />} />
          <Route path="dashboard" element={<DepartmentDashboard />} />
          <Route path="complaints" element={<DepartmentComplaints />} />
          <Route path="complaints/:complaintId" element={<ComplaintDetailView />} />
          <Route path="my-work" element={<MyWorkView />} />
          <Route path="work-card" element={<WorkCardView />} />
          <Route path="map" element={<DepartmentMap />} />
          <Route path="escalations" element={<DepartmentEscalations />} />
          <Route path="performance" element={<DepartmentPerformance />} />
        </Route>
      </Route>

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route element={<ProtectedAdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="complaints" element={<AdminComplaints />} />
          <Route path="complaints/:id" element={<AdminComplaintDetail />} />
          <Route path="departments" element={<DepartmentOverview />} />
          <Route path="departments/:id" element={<DepartmentDetailPage />} />
          <Route path="map" element={<AdminCivicMap />} />
          <Route path="escalations" element={<AdminEscalations />} />
          <Route path="feedback" element={<FeedbackOverview />} />
          <Route path="performance" element={<AdminPerformance />} />
          <Route path="initiatives" element={<InitiativeManager />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="assets" element={<AdminAssetLedger />} />
          <Route path="wards" element={<AdminWardReality />} />
          <Route path="open-data" element={<AdminOpenData />} />
        </Route>
      </Route>

      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {PLACEHOLDER_ROUTES.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={<PlaceholderPage title={route.title} description={route.description} />}
        />
      ))}

      {/* A genuine 404 rather than a silent redirect to the homepage. */}
      <Route
        path="*"
        element={
          <PlaceholderPage
            variant="not-found"
            title="We couldn't find that page"
            description="The link may be out of date, or the address may have a typo. You can still report an issue or track an existing complaint."
          />
        }
      />
    </Routes>
    </Suspense>
  );
}
