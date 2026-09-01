// ============================================================
// Seeded asset repair ledger — Gwalior
// ============================================================
//
// The repair history that makes the asset layer worth having. Without a
// ledger, "has this been fixed before?" — the single most important
// question in municipal maintenance — has no answer.
//
// Timestamps are relative to "now" so the demo never goes stale, and the
// spread is deliberate rather than random:
//
//   * GWL-RD-0142 (Phool Bagh Road) carries three repairs in eight
//     months. The open pothole complaint against it is therefore a
//     REPEAT FAILURE, and the most recent repair still sits inside a
//     36-month defect liability period — so it is a warranty claim
//     against the contractor, not a fresh municipal expense.
//   * Drain nodes carry monsoon-clustered history, so pre-monsoon
//     positioning has a real seasonal distribution to read.
//   * Several assets carry a single clean repair, so the ledger does not
//     read as though everything in Gwalior fails repeatedly.
//
// Contractor names are fictional. Attribution is INTERNAL ONLY and is
// never rendered on a public surface — see the note in assetService.

import type { AssetRepair } from '../types/asset';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** Contractors carrying live defect liability on Gwalior works. */
export const CONTRACTORS = [
  { id: 'CTR-114', name: 'Shreeji Infra Works' },
  { id: 'CTR-207', name: 'Gwalior Roadlines Pvt Ltd' },
  { id: 'CTR-318', name: 'Chambal Civil Contractors' },
  { id: 'CTR-402', name: 'Vindhya Drainage Services' },
] as const;

/**
 * Defect liability defaults, in months, by work type.
 *
 * Indian municipal road contracts commonly run 12-36 months. Municipal
 * Corporation Chandigarh raised its road DLP from one year to three,
 * which is the precedent this range is anchored to. A real deployment
 * reads these from the works department's contract register rather than
 * from a constant.
 */
export const DEFAULT_DLP_MONTHS: Record<string, number> = {
  roads: 36,
  infrastructure: 24,
  water: 12,
  streetlights: 12,
  garbage: 0,
};

export function buildSeedAssetRepairs(): AssetRepair[] {
  return [
    // -----------------------------------------------------------
    // GWL-RD-0142 — the demonstration asset.
    // Three patches in eight months on the same 300 m of road.
    // -----------------------------------------------------------
    {
      id: 'REP-0142-03',
      assetId: 'GWL-RD-0142',
      complaintId: 'JS-GWL-2026-001240',
      category: 'roads',
      completedAt: ago(152),
      note: 'Full-depth patch, 14 sq m, hot-mix asphalt. Lane reopened same evening.',
      crew: 'PWD Maintenance Unit 2',
      contractorId: 'CTR-207',
      contractorName: 'Gwalior Roadlines Pvt Ltd',
      defectLiabilityMonths: 36,
      captureGrade: 'verified',
      costEstimate: 148000,
    },
    {
      id: 'REP-0142-02',
      assetId: 'GWL-RD-0142',
      category: 'roads',
      completedAt: ago(221),
      note: 'Cold-mix patch applied to two depressions near the crossing.',
      crew: 'PWD Maintenance Unit 2',
      contractorId: 'CTR-207',
      contractorName: 'Gwalior Roadlines Pvt Ltd',
      defectLiabilityMonths: 36,
      captureGrade: 'unverified',
      costEstimate: 61000,
    },
    {
      id: 'REP-0142-01',
      assetId: 'GWL-RD-0142',
      category: 'roads',
      completedAt: ago(398),
      note: 'Resurfacing of the City Centre stretch under the annual road programme.',
      crew: 'PWD Works Division',
      contractorId: 'CTR-114',
      contractorName: 'Shreeji Infra Works',
      defectLiabilityMonths: 36,
      captureGrade: 'unverified',
      costEstimate: 940000,
    },

    // -----------------------------------------------------------
    // Drain nodes — monsoon-clustered, which is what makes
    // pre-monsoon positioning a query rather than a forecast.
    // -----------------------------------------------------------
    {
      id: 'REP-0121-02',
      assetId: 'GWL-DR-0121',
      category: 'water',
      completedAt: ago(96),
      note: 'Desilting of the Victoria Market drain ahead of the monsoon. 3.2 m3 silt lifted.',
      crew: 'Water Works Desilting Crew A',
      contractorId: 'CTR-402',
      contractorName: 'Vindhya Drainage Services',
      defectLiabilityMonths: 12,
      captureGrade: 'verified',
      costEstimate: 74000,
    },
    {
      id: 'REP-0121-01',
      assetId: 'GWL-DR-0121',
      category: 'water',
      completedAt: ago(451),
      note: 'Drain cover replaced and channel cleared after monsoon backflow.',
      crew: 'Water Works Desilting Crew A',
      contractorId: 'CTR-402',
      contractorName: 'Vindhya Drainage Services',
      defectLiabilityMonths: 12,
      captureGrade: 'unverified',
      costEstimate: 52000,
    },
    {
      id: 'REP-0104-01',
      assetId: 'GWL-DR-0104',
      category: 'water',
      completedAt: ago(112),
      note: 'Morar Cantt outfall desilted; inlet grating re-seated.',
      crew: 'Water Works Desilting Crew B',
      contractorId: 'CTR-402',
      contractorName: 'Vindhya Drainage Services',
      defectLiabilityMonths: 12,
      captureGrade: 'verified',
      costEstimate: 68000,
    },
    {
      id: 'REP-0112-01',
      assetId: 'GWL-DR-0112',
      category: 'water',
      completedAt: ago(438),
      note: 'Storm drain flushed and silt trap cleared. Not revisited since.',
      crew: 'Water Works Desilting Crew B',
      defectLiabilityMonths: 12,
      captureGrade: 'unverified',
      costEstimate: 44000,
    },
    {
      id: 'REP-0096-01',
      assetId: 'GWL-DR-0096',
      category: 'water',
      completedAt: ago(402),
      note: 'Phool Bagh nala section desilted under the pre-monsoon drive.',
      crew: 'Water Works Desilting Crew A',
      defectLiabilityMonths: 12,
      captureGrade: 'unverified',
      costEstimate: 58000,
    },

    // -----------------------------------------------------------
    // Streetlights and infrastructure — mostly single, clean repairs.
    // A ledger where everything fails repeatedly is not credible.
    // -----------------------------------------------------------
    {
      id: 'REP-0371-01',
      assetId: 'GWL-SL-0371',
      complaintId: 'JS-GWL-2026-001175',
      category: 'streetlights',
      completedAt: ago(64),
      note: 'LED luminaire replaced and driver rewired at Thatipur Circle.',
      crew: 'Electrical Maintenance Team 1',
      contractorId: 'CTR-318',
      contractorName: 'Chambal Civil Contractors',
      defectLiabilityMonths: 12,
      captureGrade: 'verified',
      costEstimate: 18000,
    },
    {
      id: 'REP-0344-02',
      assetId: 'GWL-SL-0344',
      category: 'streetlights',
      completedAt: ago(38),
      note: 'Exposed wiring insulated and pole certified safe. School zone priority.',
      crew: 'Electrical Emergency Team',
      contractorId: 'CTR-318',
      contractorName: 'Chambal Civil Contractors',
      defectLiabilityMonths: 12,
      captureGrade: 'verified',
      costEstimate: 22000,
    },
    {
      id: 'REP-0344-01',
      assetId: 'GWL-SL-0344',
      category: 'streetlights',
      completedAt: ago(196),
      note: 'Pole 344 re-lamped during the smart streetlight upgrade.',
      crew: 'Electrical Maintenance Team 2',
      contractorId: 'CTR-318',
      contractorName: 'Chambal Civil Contractors',
      defectLiabilityMonths: 12,
      captureGrade: 'unverified',
      costEstimate: 16000,
    },
    {
      id: 'REP-0210-01',
      assetId: 'GWL-FP-0210',
      category: 'infrastructure',
      completedAt: ago(279),
      note: 'Footpath slabs relaid across an 18 m stretch outside the market.',
      crew: 'Urban Infrastructure Cell',
      contractorId: 'CTR-114',
      contractorName: 'Shreeji Infra Works',
      defectLiabilityMonths: 24,
      captureGrade: 'unverified',
      costEstimate: 132000,
    },
    {
      id: 'REP-0184-01',
      assetId: 'GWL-RD-0184',
      category: 'roads',
      completedAt: ago(88),
      note: 'Thatipur Circle Road pothole cluster patched, 9 sq m.',
      crew: 'PWD Maintenance Unit 3',
      contractorId: 'CTR-207',
      contractorName: 'Gwalior Roadlines Pvt Ltd',
      defectLiabilityMonths: 36,
      captureGrade: 'verified',
      costEstimate: 96000,
    },
    {
      id: 'REP-0195-01',
      assetId: 'GWL-RD-0195',
      category: 'roads',
      completedAt: ago(512),
      note: 'Maharaj Bada Circular Road resurfaced under the heritage corridor works.',
      crew: 'PWD Works Division',
      contractorId: 'CTR-114',
      contractorName: 'Shreeji Infra Works',
      defectLiabilityMonths: 36,
      captureGrade: 'unverified',
      costEstimate: 1240000,
    },
  ];
}
