import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { PortalAccess } from './components/PortalAccess/PortalAccess';
import { IssueCategories } from './components/IssueCategories/IssueCategories';
import { HowItWorks } from './components/HowItWorks/HowItWorks';
import { Footer } from './components/Footer/Footer';
import { MobileActionBar } from './components/MobileActionBar/MobileActionBar';
import { ReportWizard } from './components/ReportWizard/ReportWizard';
import { TrackComplaint } from './components/TrackComplaint/TrackComplaint';
import { PlaceholderPage } from './components/Placeholder/PlaceholderPage';

/* ------------------------------------------------------------
   Portal screens load on demand.
   ------------------------------------------------------------
   A citizen filing a pothole report was downloading the entire Command
   Centre — every chart, map and analytics screen — before the first
   paint, on the mobile connection this product is mostly used on. The
   portals are behind a sign-in that citizens never pass, so their code
   has no business in the initial bundle.

   The citizen routes (/, /report, /track) stay statically imported:
   they ARE the first paint, and deferring them would only add a
   round trip.
   ------------------------------------------------------------ */

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

// Route guards
import { ProtectedAdminRoute, ProtectedDepartmentRoute } from './components/auth/ProtectedRoute';
import { UnauthorizedPage } from './components/auth/UnauthorizedPage';

import './App.css';

function LandingPage() {
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
