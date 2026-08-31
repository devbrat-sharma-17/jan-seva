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

// Department Operations Ecosystem (Phase 4)
import { DepartmentLogin } from './components/Department/DepartmentLogin';
import { DepartmentLayout } from './components/Department/DepartmentLayout';
import { DepartmentDashboard } from './components/Department/Dashboard/DepartmentDashboard';
import { DepartmentComplaints } from './components/Department/Complaints/DepartmentComplaints';
import { ComplaintDetailView } from './components/Department/Complaints/ComplaintDetailView';
import { MyWorkView } from './components/Department/MyWork/MyWorkView';
import { DepartmentMap } from './components/Department/Map/DepartmentMap';
import { DepartmentEscalations } from './components/Department/Escalations/DepartmentEscalations';
import { DepartmentPerformance } from './components/Department/Performance/DepartmentPerformance';

// Admin Command Center Ecosystem (Phase 5)
import { AdminLogin } from './components/Admin/AdminLogin';
import { AdminLayout } from './components/Admin/AdminLayout';
import { AdminDashboard } from './components/Admin/Dashboard/AdminDashboard';
import { AdminComplaints } from './components/Admin/Complaints/AdminComplaints';
import { AdminComplaintDetail } from './components/Admin/Complaints/AdminComplaintDetail';
import { DepartmentOverview } from './components/Admin/Departments/DepartmentOverview';
import { DepartmentDetailPage } from './components/Admin/Departments/DepartmentDetailPage';
import { AdminCivicMap } from './components/Admin/Map/AdminCivicMap';
import { AdminEscalations } from './components/Admin/Escalations/AdminEscalations';
import { FeedbackOverview } from './components/Admin/Feedback/FeedbackOverview';
import { AdminPerformance } from './components/Admin/Performance/AdminPerformance';
import { InitiativeManager } from './components/Admin/Initiatives/InitiativeManager';
import { AdminReports } from './components/Admin/Reports/AdminReports';

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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/report" element={<ReportWizard />} />
      <Route path="/report-issue" element={<ReportWizard />} />
      <Route path="/track" element={<TrackComplaint />} />

      {/* Department Portal (Phase 4) */}
      <Route path="/department/login" element={<DepartmentLogin />} />
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

      {/* Admin Command Center (Phase 5) */}
      <Route path="/admin/login" element={<AdminLogin />} />
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
  );
}
