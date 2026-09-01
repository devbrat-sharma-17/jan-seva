// ============================================================
// Seeded historical complaints — 18 months of civic record
// ============================================================
//
// Every feature that reads history — the asset ledger, repeat-failure
// detection, pre-monsoon positioning, durability rates — needs history
// to read. The live seed holds fifteen complaints spanning about a
// week, which is enough to demonstrate a queue and nothing else.
//
// These are ARCHIVED records: resolved, past their identity retention
// window, and therefore carrying no reporter identity at all. That is
// not a shortcut — it is exactly what the retention split produces. An
// eighteen-month-old complaint SHOULD have no citizen attached to it,
// and building the historical seed any other way would misrepresent
// what the product keeps.
//
// The distribution is deliberate rather than random:
//   * drain and road failures cluster in June-September, so the
//     pre-monsoon query has a real seasonal signal to find;
//   * a handful of assets carry several failures, so recurrence is
//     visible without every asset looking broken;
//   * outcomes are mixed — some citizen-verified, some closed without
//     confirmation — so the quality score has something to separate.

import type { Complaint } from '../types';
import { CIVIC_ASSETS } from './civicAssets';

const DAY = 24 * 60 * 60 * 1000;

/** A date `daysAgo` in the past, at a plausible hour of the working day. */
function pastIso(daysAgo: number, hour = 10): string {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setHours(hour, (daysAgo * 7) % 60, 0, 0);
  return d.toISOString();
}

const DEPARTMENTS_BY_CATEGORY: Record<
  string,
  { id: string; name: string; division: string; helpline: string }
> = {
  roads: {
    id: 'roads',
    name: 'Public Works Department (PWD)',
    division: 'Gwalior Division 2',
    helpline: '0751-2441234',
  },
  water: {
    id: 'water',
    name: 'Public Health & Water Works',
    division: 'Central Zone, Gwalior',
    helpline: '0751-2443456',
  },
  garbage: {
    id: 'sanitation',
    name: 'Municipal Sanitation Department',
    division: 'Zone 3, Gwalior',
    helpline: '0751-2442345',
  },
  streetlights: {
    id: 'electrical',
    name: 'Municipal Electrical Division',
    division: 'West Zone, Gwalior',
    helpline: '0751-2445678',
  },
  infrastructure: {
    id: 'infrastructure',
    name: 'Urban Infrastructure Cell',
    division: 'Gwalior Municipal Central',
    helpline: '0751-2446789',
  },
};

const TITLES: Record<string, string> = {
  roads: 'Road surface failure',
  water: 'Drain overflow during heavy rain',
  garbage: 'Uncollected waste at collection point',
  streetlights: 'Streetlight not working',
  infrastructure: 'Damaged public structure',
};

interface HistorySpec {
  /** Asset the complaint sits on. Coordinates are taken from it. */
  assetId: string;
  category: string;
  daysAgo: number;
  /** Days from report to resolution. */
  resolvedAfterDays: number;
  citizenVerified: boolean;
  evidenceGrade?: 'verified' | 'unverified' | 'disputed';
  note: string;
}

/**
 * The historical record.
 *
 * `daysAgo` values are chosen so the monsoon-category entries land in
 * June-September of the previous two seasons. They are written out
 * rather than generated from a random seed so the demo is reproducible
 * and so anyone reading this file can see exactly what was asserted.
 */
const HISTORY: HistorySpec[] = [
  // --- Last monsoon (roughly 380-470 days ago) ---
  { assetId: 'GWL-DR-0121', category: 'water', daysAgo: 452, resolvedAfterDays: 6, citizenVerified: true, evidenceGrade: 'unverified', note: 'Victoria Market drain backflowed into the road during heavy rain.' },
  { assetId: 'GWL-DR-0112', category: 'water', daysAgo: 441, resolvedAfterDays: 9, citizenVerified: true, evidenceGrade: 'unverified', note: 'Storm drain choked; water standing across the junction for two days.' },
  { assetId: 'GWL-DR-0096', category: 'water', daysAgo: 436, resolvedAfterDays: 4, citizenVerified: false, evidenceGrade: 'unverified', note: 'Phool Bagh nala overflowing at the crossing.' },
  { assetId: 'GWL-DR-0104', category: 'water', daysAgo: 428, resolvedAfterDays: 11, citizenVerified: true, evidenceGrade: 'unverified', note: 'Morar Cantt outfall blocked; sewage on the service road.' },
  { assetId: 'GWL-RD-0142', category: 'roads', daysAgo: 421, resolvedAfterDays: 23, citizenVerified: true, evidenceGrade: 'unverified', note: 'Monsoon damage across the City Centre stretch.' },
  { assetId: 'GWL-RD-0195', category: 'roads', daysAgo: 415, resolvedAfterDays: 31, citizenVerified: false, evidenceGrade: 'unverified', note: 'Surface break-up on the Bada circular road after the rains.' },
  { assetId: 'GWL-DR-0145', category: 'water', daysAgo: 409, resolvedAfterDays: 7, citizenVerified: true, evidenceGrade: 'unverified', note: 'Hazira Chowk drain overflowing across the market approach.' },
  { assetId: 'GWL-BN-0466', category: 'garbage', daysAgo: 402, resolvedAfterDays: 3, citizenVerified: true, evidenceGrade: 'unverified', note: 'Waste washed out of the collection point during heavy rain.' },

  // --- Between seasons ---
  { assetId: 'GWL-SL-0344', category: 'streetlights', daysAgo: 341, resolvedAfterDays: 5, citizenVerified: true, evidenceGrade: 'unverified', note: 'Pole 344 dark for a week outside the school gate.' },
  { assetId: 'GWL-FP-0210', category: 'infrastructure', daysAgo: 288, resolvedAfterDays: 19, citizenVerified: true, evidenceGrade: 'unverified', note: 'Footpath slabs lifted outside the market, tripping hazard.' },
  { assetId: 'GWL-RD-0184', category: 'roads', daysAgo: 264, resolvedAfterDays: 14, citizenVerified: false, evidenceGrade: 'unverified', note: 'Pothole cluster at Thatipur Circle.' },
  { assetId: 'GWL-BN-0453', category: 'garbage', daysAgo: 231, resolvedAfterDays: 2, citizenVerified: true, evidenceGrade: 'unverified', note: 'Collection missed for four consecutive days in Sector 1.' },
  { assetId: 'GWL-SL-0371', category: 'streetlights', daysAgo: 214, resolvedAfterDays: 6, citizenVerified: true, evidenceGrade: 'unverified', note: 'Thatipur Circle luminaire failing intermittently.' },
  { assetId: 'GWL-RD-0142', category: 'roads', daysAgo: 226, resolvedAfterDays: 5, citizenVerified: true, evidenceGrade: 'unverified', note: 'Two depressions opening again near the crossing.' },

  // --- This monsoon (roughly 60-120 days ago) ---
  { assetId: 'GWL-DR-0121', category: 'water', daysAgo: 101, resolvedAfterDays: 5, citizenVerified: true, evidenceGrade: 'verified', note: 'Same drain backflowing again in the first heavy spell.' },
  { assetId: 'GWL-DR-0104', category: 'water', daysAgo: 118, resolvedAfterDays: 6, citizenVerified: true, evidenceGrade: 'verified', note: 'Morar outfall blocked again; standing water at the gate.' },
  { assetId: 'GWL-DR-0112', category: 'water', daysAgo: 96, resolvedAfterDays: 12, citizenVerified: false, evidenceGrade: 'unverified', note: 'Thatipur storm drain overflowing; nothing done since last season.' },
  { assetId: 'GWL-DR-0107', category: 'water', daysAgo: 88, resolvedAfterDays: 8, citizenVerified: true, evidenceGrade: 'verified', note: 'Side drain at Morar Station overflowing onto the platform road.' },
  { assetId: 'GWL-DR-0130', category: 'water', daysAgo: 84, resolvedAfterDays: 15, citizenVerified: false, evidenceGrade: 'unverified', note: 'Maharajpura culvert silted; water backing into the colony.' },
  { assetId: 'GWL-RD-0184', category: 'roads', daysAgo: 91, resolvedAfterDays: 9, citizenVerified: true, evidenceGrade: 'verified', note: 'Thatipur Circle surface breaking up again after the rains.' },
  { assetId: 'GWL-RD-0203', category: 'roads', daysAgo: 79, resolvedAfterDays: 21, citizenVerified: true, evidenceGrade: 'verified', note: 'Airport road edge failure after sustained rain.' },
  { assetId: 'GWL-BN-0441', category: 'garbage', daysAgo: 74, resolvedAfterDays: 2, citizenVerified: true, evidenceGrade: 'verified', note: 'Sabzi Mandi collection point overflowing in the wet.' },
  { assetId: 'GWL-DR-0138', category: 'water', daysAgo: 71, resolvedAfterDays: 10, citizenVerified: true, evidenceGrade: 'unverified', note: 'Gole Ka Mandir nala overtopping at the square.' },
  { assetId: 'GWL-RD-0142', category: 'roads', daysAgo: 156, resolvedAfterDays: 4, citizenVerified: true, evidenceGrade: 'verified', note: 'Full-depth patch on the City Centre stretch.' },

  // --- Recent, post-monsoon ---
  { assetId: 'GWL-SL-0362', category: 'streetlights', daysAgo: 52, resolvedAfterDays: 3, citizenVerified: true, evidenceGrade: 'verified', note: 'Morar Station Road pole dark since the storm.' },
  { assetId: 'GWL-BN-0428', category: 'garbage', daysAgo: 44, resolvedAfterDays: 1, citizenVerified: true, evidenceGrade: 'verified', note: 'Phool Bagh market bin point overflowing at the weekend.' },
  { assetId: 'GWL-FP-0221', category: 'infrastructure', daysAgo: 38, resolvedAfterDays: 12, citizenVerified: false, evidenceGrade: 'unverified', note: 'Garden footpath railing broken near the north gate.' },
  { assetId: 'GWL-SL-0413', category: 'streetlights', daysAgo: 33, resolvedAfterDays: 4, citizenVerified: true, evidenceGrade: 'verified', note: 'Gole Ka Mandir square light out.' },
  { assetId: 'GWL-RD-0231', category: 'roads', daysAgo: 27, resolvedAfterDays: 16, citizenVerified: true, evidenceGrade: 'verified', note: 'Pinto Park colony road resurfaced after complaints.' },
  { assetId: 'GWL-BN-0503', category: 'garbage', daysAgo: 21, resolvedAfterDays: 2, citizenVerified: false, evidenceGrade: 'unverified', note: 'Hazira mandi waste not lifted for three days.' },
];

/**
 * Builds the archived historical complaints.
 *
 * Note what these records deliberately do NOT carry: no reporter name,
 * no masked number, no identity reference, no photographs. They are
 * past their identity retention window, so those fields are gone — and
 * the asset link, the department, the outcome and the evidence grade
 * remain. That is the retention split working as designed, and it is
 * also why an eighteen-month repair history is possible at all.
 */
export function buildHistoricalComplaints(): Complaint[] {
  const assetsById = new Map(CIVIC_ASSETS.map((a) => [a.id, a]));

  return HISTORY.flatMap((spec, index) => {
    const asset = assetsById.get(spec.assetId);
    if (!asset) return [];

    const createdAt = pastIso(spec.daysAgo, 9 + (index % 8));
    const resolvedAt = pastIso(spec.daysAgo - spec.resolvedAfterDays, 15);
    const dept = DEPARTMENTS_BY_CATEGORY[spec.category];

    return [
      {
        /* Real ticket grammar, and numbered from the year the report
           was actually filed — an archived record with a malformed ID
           would fail `isValidTicketFormat` and read as fabricated. */
        id: `JS-GWL-${new Date(createdAt).getFullYear()}-${String(800001 + index)}`,
        cityId: 'gwalior',
        createdAt,
        updatedAt: resolvedAt,
        status: 'resolved',
        version: 1,

        issue: {
          category: spec.category,
          title: `${TITLES[spec.category]} — ${asset.locality}`,
          description: spec.note,
        },

        // No photographs on an archived record.
        photos: [],

        location: {
          latitude: asset.centroid.latitude,
          longitude: asset.centroid.longitude,
          address: asset.name,
          locality: asset.locality,
          city: 'Gwalior',
          state: 'Madhya Pradesh',
          source: 'gps',
        },

        // Identity retention has lapsed. There is nothing here to remove
        // because there is nothing here.
        reporter: { name: 'Archived record', identityVerified: false },

        assetId: asset.id,

        aiAnalysis: {
          category: spec.category,
          severity: spec.category === 'water' ? 'high' : 'medium',
          priorityScore: spec.category === 'water' ? 84 : 72,
          department: dept.id,
        },

        department: dept,

        sla: {
          dueAt: pastIso(spec.daysAgo - 2, 18),
          status: 'normal',
        },

        timeline: [
          {
            id: `evt-h-${index}-2`,
            title: 'Work completed',
            description: spec.note,
            timestamp: resolvedAt,
            status: 'resolved',
            actor: dept.name,
            actorType: 'officer',
            visibility: 'public',
          },
          {
            id: `evt-h-${index}-1`,
            title: 'Complaint received',
            description: 'Reported through JAN-SEVA.',
            timestamp: createdAt,
            status: 'pending',
            actor: 'Citizen Portal',
            actorType: 'citizen',
            visibility: 'public',
          },
        ],

        latestUpdate: {
          title: 'Work completed',
          description: spec.note,
          timestamp: resolvedAt,
        },

        resolution: {
          resolvedAt,
          resolutionNote: spec.note,
          resolvedBy: dept.name,
          citizenVerifiedResolved: spec.citizenVerified,
          citizenVerifiedAt: spec.citizenVerified ? resolvedAt : undefined,
          evidenceGrade: spec.evidenceGrade,
        },
      } satisfies Complaint,
    ];
  });
}
