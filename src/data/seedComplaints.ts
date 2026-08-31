// ============================================================
// Seed complaints — Gwalior demo data
// ============================================================
// Timestamps are generated relative to "now" rather than pinned to fixed
// dates, so the demo always shows a live spread of states: one nearing its
// SLA, one breached, one resolved inside the retention window, and one
// resolved past it. Hardcoded dates go stale and every complaint eventually
// reads as breached.

import type { Complaint } from '../types';
import { deriveIdentityReference } from '../services/identityService';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();

// Demo citizens. Only the derived reference and the mask are ever stored.
const RAJ = {
  name: 'Raj Sharma',
  reference: deriveIdentityReference('mobile', '9876543210'),
  masked: '+91 XXXXX 43210',
};

const ANJALI = {
  name: 'Anjali Gupta',
  reference: deriveIdentityReference('mobile', '9888888221'),
  masked: '+91 XXXXX 88221',
};

const PRIYA = {
  name: 'Priya Singh',
  reference: deriveIdentityReference('mobile', '9876501234'),
  masked: '+91 XXXXX 01234',
};

const VIKRAM = {
  name: 'Vikram Patel',
  reference: deriveIdentityReference('mobile', '9999912345'),
  masked: '+91 XXXXX 12345',
};

const MEENA = {
  name: 'Meena Kumari',
  reference: deriveIdentityReference('mobile', '9811100456'),
  masked: '+91 XXXXX 00456',
};

export function buildSeedComplaints(): Complaint[] {
  return [
    // ---------------------------------------------------------------
    // 1. Active, SLA approaching, linked to a primary issue.
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001284',
      cityId: 'gwalior',
      createdAt: ago(2 * DAY + 6 * HOUR),
      updatedAt: ago(3 * HOUR),
      status: 'in-progress',
      issue: {
        category: 'roads',
        title: 'Deep pothole on main road near City Centre',
        description:
          'Large pothole near the City Centre crossing causing traffic bottlenecks and a real danger for two-wheelers, especially after dark.',
      },
      photos: [
        'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80',
      ],
      location: {
        latitude: 26.2052,
        longitude: 78.1924,
        address: 'Phool Bagh Road, near City Centre crossing',
        locality: 'City Centre',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: RAJ.name,
        mobileMasked: RAJ.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: RAJ.reference,
        identityLabel: RAJ.masked,
      },
      aiAnalysis: {
        category: 'roads',
        categoryTitle: 'Roads & Potholes',
        severity: 'high',
        priorityScore: 88,
        department: 'pwd',
      },
      department: {
        name: 'Public Works Department (PWD)',
        division: 'Gwalior Division 2',
        helpline: '0751-2441234',
      },
      assignedOfficer: { name: 'Er. Ramesh Verma', designation: 'Assistant Engineer, PWD Gwalior' },
      sla: { dueAt: ahead(6 * HOUR), status: 'approaching' },
      duplicate: {
        isLinked: true,
        primaryIssueId: 'JS-GWL-2026-001240',
        primaryTitle: 'Road surface failure at City Centre crossing',
        supportingCount: 18,
      },
      timeline: [
        {
          id: 'evt-1284-4',
          title: 'Inspection completed, repair scheduled',
          description:
            'Field inspection completed. Road resurfacing crew scheduled with hot-mix asphalt.',
          timestamp: ago(3 * HOUR),
          status: 'in-progress',
          actor: 'PWD Field Team',
        },
        {
          id: 'evt-1284-3',
          title: 'Officer assigned',
          description: 'Er. Ramesh Verma assigned to oversee the road inspection.',
          timestamp: ago(2 * DAY + 4 * HOUR),
          status: 'assigned',
          actor: 'PWD Gwalior',
        },
        {
          id: 'evt-1284-2',
          title: 'Routed to Public Works Department',
          description: 'Automated classification assigned this issue to PWD Gwalior Division 2.',
          timestamp: ago(2 * DAY + 6 * HOUR - 2 * 60 * 1000),
          status: 'assigned',
          actor: 'JAN-SEVA Routing Engine',
        },
        {
          id: 'evt-1284-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA with GPS location and photo evidence.',
          timestamp: ago(2 * DAY + 6 * HOUR),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Inspection completed, repair scheduled',
        description:
          'Field inspection completed. The resurfacing crew is scheduled with hot-mix asphalt.',
        timestamp: ago(3 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 2. The primary issue that (1) is linked to.
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001240',
      cityId: 'gwalior',
      createdAt: ago(4 * DAY),
      updatedAt: ago(3 * HOUR),
      status: 'in-progress',
      issue: {
        category: 'roads',
        title: 'Road surface failure at City Centre crossing',
        description:
          'Multiple potholes and surface break-up across the City Centre crossing after the monsoon.',
      },
      photos: [
        'https://images.unsplash.com/photo-1601119483354-5b1b9f4ff67c?w=800&auto=format&fit=crop&q=80',
      ],
      location: {
        latitude: 26.2054,
        longitude: 78.1927,
        address: 'City Centre crossing, Gwalior',
        locality: 'City Centre',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: ANJALI.name,
        mobileMasked: ANJALI.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: ANJALI.reference,
        identityLabel: ANJALI.masked,
      },
      department: {
        name: 'Public Works Department (PWD)',
        division: 'Gwalior Division 2',
        helpline: '0751-2441234',
      },
      assignedOfficer: { name: 'Er. Ramesh Verma', designation: 'Assistant Engineer, PWD Gwalior' },
      sla: { dueAt: ahead(6 * HOUR), status: 'approaching' },
      duplicate: { isLinked: false, supportingCount: 19 },
      timeline: [
        {
          id: 'evt-1240-2',
          title: 'Resurfacing work order raised',
          description: 'Work order raised covering the full crossing rather than spot repairs.',
          timestamp: ago(3 * HOUR),
          status: 'in-progress',
          actor: 'PWD Gwalior',
        },
        {
          id: 'evt-1240-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA.',
          timestamp: ago(4 * DAY),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Resurfacing work order raised',
        description: 'A work order now covers the full crossing rather than individual spots.',
        timestamp: ago(3 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 3. Resolved 6 hours ago — inside the 48h window, awaiting the
    //    citizen's confirmation. Carries before/after evidence.
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001175',
      cityId: 'gwalior',
      createdAt: ago(3 * DAY),
      updatedAt: ago(6 * HOUR),
      status: 'resolved',
      issue: {
        category: 'streetlights',
        title: 'Broken streetlight near Thatipur Circle',
        description: 'Dark stretch on the main road due to a faulty LED lamp on pole number 42.',
      },
      photos: [
        'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
      ],
      location: {
        latitude: 26.2167,
        longitude: 78.2045,
        address: 'Near Thatipur Circle, Morar Road',
        locality: 'Thatipur',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: RAJ.name,
        mobileMasked: RAJ.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: RAJ.reference,
        identityLabel: RAJ.masked,
      },
      department: {
        name: 'Municipal Electrical Division',
        division: 'East Zone, Gwalior',
        helpline: '0751-2445678',
      },
      assignedOfficer: { name: 'Er. Sandeep Mishra', designation: 'Junior Engineer, Electrical' },
      sla: { dueAt: ago(30 * HOUR), status: 'normal' },
      timeline: [
        {
          id: 'evt-1175-3',
          title: 'Repair completed and lamp replaced',
          description: 'Defective LED driver and wiring replaced. Light tested and working.',
          timestamp: ago(6 * HOUR),
          status: 'resolved',
          actor: 'Electrical Maintenance Van',
        },
        {
          id: 'evt-1175-2',
          title: 'Assigned to Electrical Division',
          description: 'Assigned to the East Zone maintenance van.',
          timestamp: ago(3 * DAY - 30 * 60 * 1000),
          status: 'assigned',
          actor: 'Municipal Electrical Division',
        },
        {
          id: 'evt-1175-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA.',
          timestamp: ago(3 * DAY),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Repair completed and lamp replaced',
        description: 'The defective LED driver and wiring were replaced. The light is working.',
        timestamp: ago(6 * HOUR),
      },
      resolution: {
        evidencePhotos: [
          'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?w=800&auto=format&fit=crop&q=80',
        ],
        resolvedAt: ago(6 * HOUR),
        // Deliberately unset: this is the complaint that demonstrates the
        // citizen verification prompt.
      },
    },

    // ---------------------------------------------------------------
    // 4. Pending, no officer yet.
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001102',
      cityId: 'gwalior',
      createdAt: ago(9 * HOUR),
      updatedAt: ago(8 * HOUR),
      status: 'pending',
      issue: {
        category: 'garbage',
        title: 'Garbage accumulation near Phool Bagh',
        description:
          'Overflowing community dumpster spreading a foul smell near the market entrance.',
      },
      photos: [
        'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=800&auto=format&fit=crop&q=80',
      ],
      location: {
        latitude: 26.2124,
        longitude: 78.1672,
        address: 'Phool Bagh Garden Gate, Lashkar',
        locality: 'Phool Bagh',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: ANJALI.name,
        mobileMasked: ANJALI.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: ANJALI.reference,
        identityLabel: ANJALI.masked,
      },
      department: {
        name: 'Municipal Sanitation Department',
        division: 'Central Zone, Gwalior',
        helpline: '0751-2449900',
      },
      sla: { dueAt: ahead(15 * HOUR), status: 'normal' },
      timeline: [
        {
          id: 'evt-1102-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA with photo evidence.',
          timestamp: ago(9 * HOUR),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Complaint received',
        description: 'Awaiting assignment to a ward sanitation unit.',
        timestamp: ago(9 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 5. Escalated — SLA breached, still open.
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-000874',
      cityId: 'gwalior',
      createdAt: ago(5 * DAY),
      updatedAt: ago(20 * HOUR),
      status: 'escalated',
      issue: {
        category: 'water',
        title: 'Major pipeline burst near Lashkar Market',
        description:
          'Clean drinking water leaking onto the main road, causing severe water loss and flooding.',
      },
      photos: [],
      location: {
        latitude: 26.2011,
        longitude: 78.1612,
        address: 'Lashkar Main Market, near Maharaj Bada',
        locality: 'Maharaj Bada',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: RAJ.name,
        mobileMasked: RAJ.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: RAJ.reference,
        identityLabel: RAJ.masked,
      },
      department: {
        name: 'Public Health & Water Works (PHE)',
        division: 'Gwalior South Division',
        helpline: '0751-2443311',
      },
      assignedOfficer: { name: 'Er. Alok Jain', designation: 'Executive Engineer, PHE' },
      sla: { dueAt: ago(2 * DAY), status: 'exceeded', escalatedAt: ago(20 * HOUR) },
      timeline: [
        {
          id: 'evt-874-3',
          title: 'Escalated to Senior Municipal Officer',
          description:
            'Turnaround exceeded the 72-hour target. Automatically escalated for intervention.',
          timestamp: ago(20 * HOUR),
          status: 'escalated',
          actor: 'JAN-SEVA SLA Engine',
        },
        {
          id: 'evt-874-2',
          title: 'Initial valve inspection',
          description: 'Pressure surge detected in the distribution line.',
          timestamp: ago(4 * DAY),
          status: 'in-progress',
          actor: 'PHE Field Team',
        },
        {
          id: 'evt-874-1',
          title: 'Complaint received',
          description: 'Pipeline leakage reported via JAN-SEVA.',
          timestamp: ago(5 * DAY),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Escalated to Senior Municipal Officer',
        description:
          'This complaint passed its resolution target and has been escalated for attention.',
        timestamp: ago(20 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 6. Resolved four days ago — past the 48h window, so public
    //    tracking must refuse it and My Complaints must hide it.
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-000921',
      cityId: 'gwalior',
      createdAt: ago(7 * DAY),
      updatedAt: ago(4 * DAY),
      status: 'resolved',
      issue: {
        category: 'water',
        title: 'Water leakage near Morar Cantt Road',
        description: 'Continuous seepage from a joint on the distribution line.',
      },
      photos: [
        'https://images.unsplash.com/photo-1541544181051-e46607bc22a4?w=800&auto=format&fit=crop&q=80',
      ],
      location: {
        latitude: 26.2289,
        longitude: 78.2241,
        address: 'Morar Cantt Main Road',
        locality: 'Morar',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: RAJ.name,
        mobileMasked: RAJ.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: RAJ.reference,
        identityLabel: RAJ.masked,
      },
      department: {
        name: 'Public Health & Water Works (PHE)',
        division: 'Gwalior East Division',
        helpline: '0751-2443311',
      },
      assignedOfficer: { name: 'Er. Alok Jain', designation: 'Executive Engineer, PHE' },
      sla: { dueAt: ago(5 * DAY), status: 'normal' },
      timeline: [
        {
          id: 'evt-921-2',
          title: 'Leak sealed and line pressure restored',
          description: 'Joint replaced and the section re-pressurised.',
          timestamp: ago(4 * DAY),
          status: 'resolved',
          actor: 'PHE Field Team',
        },
        {
          id: 'evt-921-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA.',
          timestamp: ago(7 * DAY),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Leak sealed and line pressure restored',
        description: 'The joint was replaced and the section re-pressurised.',
        timestamp: ago(4 * DAY),
      },
      resolution: {
        resolvedAt: ago(4 * DAY),
        citizenVerifiedResolved: true,
      },
      feedback: {
        rating: 5,
        comment: 'Fixed quickly, thank you.',
        submittedAt: ago(4 * DAY - HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 7. Sanitation — Resolved & citizen-verified, 4★ rating.
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001310',
      cityId: 'gwalior',
      createdAt: ago(3 * DAY + 2 * HOUR),
      updatedAt: ago(1 * DAY),
      status: 'resolved',
      issue: {
        category: 'garbage',
        title: 'Open dumping near Maharajpura bus stand',
        description: 'Illegal garbage dumping blocking the footpath and causing stench near the bus terminal.',
      },
      photos: [
        'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&auto=format&fit=crop&q=80',
      ],
      location: {
        latitude: 26.1981,
        longitude: 78.2345,
        address: 'Maharajpura Bus Stand, Gate 2',
        locality: 'Maharajpura',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: PRIYA.name,
        mobileMasked: PRIYA.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: PRIYA.reference,
        identityLabel: PRIYA.masked,
      },
      aiAnalysis: {
        category: 'garbage',
        categoryTitle: 'Sanitation & Waste',
        severity: 'high',
        priorityScore: 82,
        department: 'sanitation',
      },
      department: {
        id: 'sanitation',
        name: 'Municipal Sanitation Department',
        division: 'Zone 2 (Morar & Maharajpura)',
        helpline: '0751-2442222',
      },
      assignedOfficer: { name: 'Anita Sharma', designation: 'Sanitation Operations Superintendent' },
      sla: { dueAt: ago(2 * DAY), status: 'normal' },
      timeline: [
        {
          id: 'evt-1310-3',
          title: 'Area cleaned and sanitised',
          description: 'Waste removed by compactor unit. Area disinfected and barricaded.',
          timestamp: ago(1 * DAY),
          status: 'resolved',
          actor: 'Sanitation Squad 2',
        },
        {
          id: 'evt-1310-2',
          title: 'Assigned to Zone 2 Sanitation',
          description: 'Dispatched to morning clearance route.',
          timestamp: ago(3 * DAY),
          status: 'assigned',
          actor: 'Municipal Sanitation Department',
        },
        {
          id: 'evt-1310-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA.',
          timestamp: ago(3 * DAY + 2 * HOUR),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Area cleaned and sanitised',
        description: 'Waste removed and area disinfected.',
        timestamp: ago(1 * DAY),
      },
      resolution: {
        resolvedAt: ago(1 * DAY),
        resolutionNote: 'Area cleared by compactor unit and sanitised.',
        resolvedBy: 'Sanitation Squad 2',
        citizenVerifiedResolved: true,
        citizenVerifiedAt: ago(20 * HOUR),
      },
      feedback: {
        rating: 4,
        comment: 'Good work but took a bit long.',
        submittedAt: ago(20 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 8. Sanitation — in-progress, normal SLA
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001355',
      cityId: 'gwalior',
      createdAt: ago(12 * HOUR),
      updatedAt: ago(4 * HOUR),
      status: 'in-progress',
      issue: {
        category: 'garbage',
        title: 'Overflowing bins at Thatipur market',
        description: 'Community bins near Thatipur vegetable market are overflowing, attracting stray animals.',
      },
      photos: [],
      location: {
        latitude: 26.2180,
        longitude: 78.2010,
        address: 'Thatipur Market Road',
        locality: 'Thatipur',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: VIKRAM.name,
        mobileMasked: VIKRAM.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: VIKRAM.reference,
        identityLabel: VIKRAM.masked,
      },
      aiAnalysis: {
        category: 'garbage',
        categoryTitle: 'Sanitation & Waste',
        severity: 'medium',
        priorityScore: 68,
        department: 'sanitation',
      },
      department: {
        id: 'sanitation',
        name: 'Municipal Sanitation Department',
        division: 'Zone 3 (Thatipur & City Centre)',
        helpline: '0751-2442222',
      },
      assignedOfficer: { name: 'Manoj Kumar', designation: 'Sanitation Inspector' },
      sla: { dueAt: ahead(12 * HOUR), status: 'normal' },
      timeline: [
        {
          id: 'evt-1355-2',
          title: 'Clearance crew dispatched',
          description: 'Zone 3 evening shift assigned to clear the overflowing bins.',
          timestamp: ago(4 * HOUR),
          status: 'in-progress',
          actor: 'Sanitation Inspector',
        },
        {
          id: 'evt-1355-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA.',
          timestamp: ago(12 * HOUR),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Clearance crew dispatched',
        description: 'Zone 3 evening shift on the way.',
        timestamp: ago(4 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 9. Water — Pending, SLA already breached (demo: weak metrics)
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001390',
      cityId: 'gwalior',
      createdAt: ago(2 * DAY + 8 * HOUR),
      updatedAt: ago(2 * DAY + 7 * HOUR),
      status: 'pending',
      issue: {
        category: 'water',
        title: 'No water supply in Morar since morning',
        description: 'Entire Morar sector has had no water supply since early morning. Multiple households affected.',
      },
      photos: [],
      location: {
        latitude: 26.2275,
        longitude: 78.2190,
        address: 'Morar Sector 5, Block C',
        locality: 'Morar',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: MEENA.name,
        mobileMasked: MEENA.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: MEENA.reference,
        identityLabel: MEENA.masked,
      },
      aiAnalysis: {
        category: 'water',
        categoryTitle: 'Water Supply',
        severity: 'critical',
        priorityScore: 95,
        department: 'water_works',
      },
      department: {
        id: 'water',
        name: 'Public Health & Water Works (PHE)',
        division: 'Gwalior East Division',
        helpline: '0751-2443311',
      },
      sla: { dueAt: ago(1 * DAY + 20 * HOUR), status: 'exceeded' },
      timeline: [
        {
          id: 'evt-1390-1',
          title: 'Complaint received',
          description: 'Water outage reported via JAN-SEVA.',
          timestamp: ago(2 * DAY + 8 * HOUR),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Complaint received',
        description: 'Awaiting assignment to water supply team.',
        timestamp: ago(2 * DAY + 8 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 10. Water — Resolved but citizen requested reinspection
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001220',
      cityId: 'gwalior',
      createdAt: ago(6 * DAY),
      updatedAt: ago(2 * DAY),
      status: 'resolved',
      issue: {
        category: 'water',
        title: 'Contaminated water in Lashkar area',
        description: 'Brown, murky water coming from taps in the Lashkar residential colony.',
      },
      photos: [
        'https://images.unsplash.com/photo-1584677626646-7c8f83690304?w=800&auto=format&fit=crop&q=80',
      ],
      location: {
        latitude: 26.2042,
        longitude: 78.1655,
        address: 'Lashkar Residential Colony, Block B',
        locality: 'Maharaj Bada',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: PRIYA.name,
        mobileMasked: PRIYA.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: PRIYA.reference,
        identityLabel: PRIYA.masked,
      },
      aiAnalysis: {
        category: 'water',
        categoryTitle: 'Water Supply',
        severity: 'high',
        priorityScore: 88,
        department: 'water_works',
      },
      department: {
        id: 'water',
        name: 'Public Health & Water Works (PHE)',
        division: 'Gwalior South Division',
        helpline: '0751-2443311',
      },
      assignedOfficer: { name: 'Er. Alok Jain', designation: 'Executive Engineer, PHE' },
      sla: { dueAt: ago(4 * DAY), status: 'exceeded' },
      timeline: [
        {
          id: 'evt-1220-3',
          title: 'Tank flushed and chlorinated',
          description: 'Overhead tank flushed and re-chlorinated. Water quality tested.',
          timestamp: ago(2 * DAY),
          status: 'resolved',
          actor: 'PHE Field Team',
        },
        {
          id: 'evt-1220-2',
          title: 'Investigation started',
          description: 'Water sample collected for testing.',
          timestamp: ago(5 * DAY),
          status: 'in-progress',
          actor: 'PHE Lab Unit',
        },
        {
          id: 'evt-1220-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA with photo evidence.',
          timestamp: ago(6 * DAY),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Tank flushed and chlorinated',
        description: 'Water quality tested and found acceptable.',
        timestamp: ago(2 * DAY),
      },
      resolution: {
        resolvedAt: ago(2 * DAY),
        resolutionNote: 'Tank flushed, chlorinated, and water quality tested.',
        resolvedBy: 'PHE Field Team',
        citizenVerifiedResolved: false,
      },
      feedback: {
        rating: 2,
        comment: 'Water still smells bad. Not properly fixed.',
        submittedAt: ago(1 * DAY + 18 * HOUR),
        reinspectionRequested: true,
        reinspectionNote: 'Water is still not clean.',
        reinspectionRequestedAt: ago(1 * DAY + 18 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 11. Electrical — Assigned, SLA normal
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001405',
      cityId: 'gwalior',
      createdAt: ago(18 * HOUR),
      updatedAt: ago(10 * HOUR),
      status: 'assigned',
      issue: {
        category: 'streetlights',
        title: 'Multiple streetlights out on Morar Cantonment Road',
        description: '4 consecutive streetlights are non-functional, creating a dark stretch near the cantonment area.',
      },
      photos: [],
      location: {
        latitude: 26.2265,
        longitude: 78.2200,
        address: 'Morar Cantonment Road, near Gate 3',
        locality: 'Morar',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: VIKRAM.name,
        mobileMasked: VIKRAM.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: VIKRAM.reference,
        identityLabel: VIKRAM.masked,
      },
      aiAnalysis: {
        category: 'streetlights',
        categoryTitle: 'Electrical & Streetlights',
        severity: 'medium',
        priorityScore: 72,
        department: 'electrical',
      },
      department: {
        id: 'electrical',
        name: 'Municipal Electrical Division',
        division: 'East Zone, Gwalior',
        helpline: '0751-2445678',
      },
      assignedOfficer: { name: 'Er. Sandeep Mishra', designation: 'Junior Engineer, Electrical' },
      sla: { dueAt: ahead(30 * HOUR), status: 'normal' },
      timeline: [
        {
          id: 'evt-1405-2',
          title: 'Assigned to East Zone maintenance',
          description: 'Assigned to Electrical East Zone maintenance van for inspection.',
          timestamp: ago(10 * HOUR),
          status: 'assigned',
          actor: 'Municipal Electrical Division',
        },
        {
          id: 'evt-1405-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA.',
          timestamp: ago(18 * HOUR),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Assigned to maintenance team',
        description: 'East Zone van scheduled for evening inspection.',
        timestamp: ago(10 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 12. Infrastructure — Pending, just reported
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001420',
      cityId: 'gwalior',
      createdAt: ago(3 * HOUR),
      updatedAt: ago(3 * HOUR),
      status: 'pending',
      issue: {
        category: 'infrastructure',
        title: 'Damaged park bench at Phool Bagh Garden',
        description: 'Cast-iron bench at the west entrance of Phool Bagh has broken armrest, exposing sharp metal.',
      },
      photos: [],
      location: {
        latitude: 26.2118,
        longitude: 78.1680,
        address: 'Phool Bagh Garden, West Gate',
        locality: 'Phool Bagh',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: MEENA.name,
        mobileMasked: MEENA.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: MEENA.reference,
        identityLabel: MEENA.masked,
      },
      aiAnalysis: {
        category: 'infrastructure',
        categoryTitle: 'Public Infrastructure',
        severity: 'medium',
        priorityScore: 62,
        department: 'urban_infra',
      },
      department: {
        id: 'infrastructure',
        name: 'Public Infrastructure Department',
        division: 'Gwalior Municipal Central',
        helpline: '0751-2446789',
      },
      sla: { dueAt: ahead(4 * DAY), status: 'normal' },
      timeline: [
        {
          id: 'evt-1420-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA.',
          timestamp: ago(3 * HOUR),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Complaint received',
        description: 'Awaiting assignment to infrastructure maintenance team.',
        timestamp: ago(3 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 13. Infrastructure — Resolved & citizen-verified, 5★
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001050',
      cityId: 'gwalior',
      createdAt: ago(8 * DAY),
      updatedAt: ago(5 * DAY),
      status: 'resolved',
      issue: {
        category: 'infrastructure',
        title: 'Broken railing at Jai Vilas Palace walkway',
        description: 'Protective railing near the palace walkway has come loose, posing safety risk to visitors.',
      },
      photos: [],
      location: {
        latitude: 26.2091,
        longitude: 78.1735,
        address: 'Jai Vilas Palace, East Walkway',
        locality: 'City Centre',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: ANJALI.name,
        mobileMasked: ANJALI.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: ANJALI.reference,
        identityLabel: ANJALI.masked,
      },
      aiAnalysis: {
        category: 'infrastructure',
        categoryTitle: 'Public Infrastructure',
        severity: 'high',
        priorityScore: 80,
        department: 'urban_infra',
      },
      department: {
        id: 'infrastructure',
        name: 'Public Infrastructure Department',
        division: 'Gwalior Municipal Central',
        helpline: '0751-2446789',
      },
      assignedOfficer: { name: 'Er. D. K. Tiwari', designation: 'Assistant Engineer, Infra' },
      sla: { dueAt: ago(4 * DAY), status: 'normal' },
      timeline: [
        {
          id: 'evt-1050-3',
          title: 'Railing repaired and reinforced',
          description: 'Steel railing welded, repainted, and load-tested.',
          timestamp: ago(5 * DAY),
          status: 'resolved',
          actor: 'Infrastructure Repair Unit',
        },
        {
          id: 'evt-1050-2',
          title: 'Assigned to infrastructure team',
          description: 'Task assigned to repair unit.',
          timestamp: ago(7 * DAY + 12 * HOUR),
          status: 'assigned',
          actor: 'Public Infrastructure Department',
        },
        {
          id: 'evt-1050-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA.',
          timestamp: ago(8 * DAY),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Railing repaired and reinforced',
        description: 'Railing welded, repainted, and tested.',
        timestamp: ago(5 * DAY),
      },
      resolution: {
        resolvedAt: ago(5 * DAY),
        resolutionNote: 'Railing repaired, repainted, and load-tested.',
        resolvedBy: 'Infrastructure Repair Unit',
        citizenVerifiedResolved: true,
        citizenVerifiedAt: ago(5 * DAY - 4 * HOUR),
      },
      feedback: {
        rating: 5,
        comment: 'Excellent repair work. Thank you!',
        submittedAt: ago(5 * DAY - 4 * HOUR),
      },
    },

    // ---------------------------------------------------------------
    // 14. Roads — Resolved but pending citizen verification
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001330',
      cityId: 'gwalior',
      createdAt: ago(4 * DAY + 6 * HOUR),
      updatedAt: ago(10 * HOUR),
      status: 'resolved',
      issue: {
        category: 'roads',
        title: 'Speed breaker damaged on Thatipur-Morar highway',
        description: 'Speed breaker has partially caved in, creating a jarring bump for vehicles.',
      },
      photos: [
        'https://images.unsplash.com/photo-1597766659755-e0c8ea44f726?w=800&auto=format&fit=crop&q=80',
      ],
      location: {
        latitude: 26.2195,
        longitude: 78.2080,
        address: 'Thatipur-Morar Highway, KM 3',
        locality: 'Thatipur',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: RAJ.name,
        mobileMasked: RAJ.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: RAJ.reference,
        identityLabel: RAJ.masked,
      },
      aiAnalysis: {
        category: 'roads',
        categoryTitle: 'Roads & Potholes',
        severity: 'medium',
        priorityScore: 74,
        department: 'pwd',
      },
      department: {
        id: 'roads',
        name: 'Public Works Department (PWD)',
        division: 'Gwalior Division 3',
        helpline: '0751-2441234',
      },
      assignedOfficer: { name: 'Rahul Yadav', designation: 'Junior Engineer, PWD' },
      sla: { dueAt: ago(1 * DAY), status: 'normal' },
      timeline: [
        {
          id: 'evt-1330-3',
          title: 'Speed breaker resurfaced',
          description: 'Speed breaker rebuilt with proper asphalt and marked with reflective paint.',
          timestamp: ago(10 * HOUR),
          status: 'resolved',
          actor: 'Road Repair Team A',
        },
        {
          id: 'evt-1330-2',
          title: 'Assigned to PWD Division 3',
          description: 'Assigned to road repair team.',
          timestamp: ago(4 * DAY),
          status: 'assigned',
          actor: 'PWD Gwalior',
        },
        {
          id: 'evt-1330-1',
          title: 'Complaint received',
          description: 'Report submitted via JAN-SEVA with photo evidence.',
          timestamp: ago(4 * DAY + 6 * HOUR),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Speed breaker resurfaced',
        description: 'Rebuilt with proper asphalt and reflective marking.',
        timestamp: ago(10 * HOUR),
      },
      resolution: {
        resolvedAt: ago(10 * HOUR),
        resolutionNote: 'Speed breaker rebuilt with proper asphalt and marked with reflective paint.',
        resolvedBy: 'Road Repair Team A',
        citizenVerifiedResolved: false,
        // Awaiting citizen verification — this is the "pending verification" state
      },
    },

    // ---------------------------------------------------------------
    // 15. Electrical — Resolved & citizen-verified, 4★
    // ---------------------------------------------------------------
    {
      id: 'JS-GWL-2026-001150',
      cityId: 'gwalior',
      createdAt: ago(5 * DAY + 4 * HOUR),
      updatedAt: ago(3 * DAY + 8 * HOUR),
      status: 'resolved',
      issue: {
        category: 'streetlights',
        title: 'Exposed wiring on utility pole near Phool Bagh',
        description: 'Dangling, partially exposed electrical wires on a utility pole near school zone.',
      },
      photos: [],
      location: {
        latitude: 26.2130,
        longitude: 78.1685,
        address: 'Near Phool Bagh, opposite DAV School',
        locality: 'Phool Bagh',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      reporter: {
        name: MEENA.name,
        mobileMasked: MEENA.masked,
        identityMethod: 'mobile',
        identityVerified: true,
        identityReference: MEENA.reference,
        identityLabel: MEENA.masked,
      },
      aiAnalysis: {
        category: 'streetlights',
        categoryTitle: 'Electrical & Streetlights',
        severity: 'critical',
        priorityScore: 93,
        department: 'electrical',
      },
      department: {
        id: 'electrical',
        name: 'Municipal Electrical Division',
        division: 'West Zone, Gwalior',
        helpline: '0751-2445678',
      },
      assignedOfficer: { name: 'Er. Sandeep Mishra', designation: 'Junior Engineer, Electrical' },
      sla: { dueAt: ago(3 * DAY + 12 * HOUR), status: 'normal' },
      timeline: [
        {
          id: 'evt-1150-3',
          title: 'Wiring secured and pole inspected',
          description: 'Exposed wiring insulated and secured. Pole certified safe.',
          timestamp: ago(3 * DAY + 8 * HOUR),
          status: 'resolved',
          actor: 'Electrical Maintenance Team',
        },
        {
          id: 'evt-1150-2',
          title: 'Emergency team dispatched',
          description: 'High-priority — school zone. Emergency electrical team deployed.',
          timestamp: ago(5 * DAY + 2 * HOUR),
          status: 'assigned',
          actor: 'Municipal Electrical Division',
        },
        {
          id: 'evt-1150-1',
          title: 'Complaint received',
          description: 'Critical safety report via JAN-SEVA.',
          timestamp: ago(5 * DAY + 4 * HOUR),
          status: 'pending',
          actor: 'Citizen Portal',
        },
      ],
      latestUpdate: {
        title: 'Wiring secured and pole inspected',
        description: 'All wiring insulated and pole certified safe.',
        timestamp: ago(3 * DAY + 8 * HOUR),
      },
      resolution: {
        resolvedAt: ago(3 * DAY + 8 * HOUR),
        resolutionNote: 'Exposed wiring insulated and secured. Pole inspected and certified safe.',
        resolvedBy: 'Electrical Maintenance Team',
        citizenVerifiedResolved: true,
        citizenVerifiedAt: ago(3 * DAY + 4 * HOUR),
      },
      feedback: {
        rating: 4,
        comment: 'Fast response for a safety issue. Good work.',
        submittedAt: ago(3 * DAY + 4 * HOUR),
      },
    },
  ];
}
