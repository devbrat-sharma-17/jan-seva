// ============================================================
// Work Card Service — One-Trip field batching
// ============================================================
//
// `assignComplaint` assigns one officer to one complaint. There is no
// route, no day and no batch, and MyWorkView is a filtered list rather
// than a field tool. A crew that drives across Gwalior for one pothole
// and back has burned a day, and municipal field capacity — not
// complaint volume, and certainly not dashboards — is the binding
// constraint in an Indian city.
//
// Chicago CDOT has run the answer for years: a daily map of 311-reported
// potholes, routes computed so each crew fills the most possible, and
// crews fill every pothole on the block once they have arrived.
//
//   THIS IS A GREEDY NEAREST-NEIGHBOUR HEURISTIC OVER STRAIGHT-LINE
//   DISTANCE. It is not "AI optimisation" and is not described as one
//   anywhere in the UI. Saying what it actually is reads as more
//   credible, not less. Real road-network routing (OSRM or Valhalla),
//   crew capacity, material constraints and time windows are the
//   backend version, and are named on the roadmap rather than implied.
//
// This is also the only feature in this release that makes a municipal
// worker's day SHORTER rather than more surveilled — which is the
// difference between a system a department tolerates and one it uses.

import type { WorkCard, WorkCardStop } from '../types/field';
import type { DepartmentId } from '../types/department';
import type { Complaint } from '../types';
import { distanceMetres, type LatLng } from './geoService';
import { computeSlaHealth } from './slaService';
import { assetForComplaint, detectRepeatFailure } from './assetService';
import { defaultCity } from '../data/cities';
import { DEPARTMENTS } from '../data/departments';

/** Stops per card. Beyond this a card stops being a day and becomes a wish. */
export const MAX_STOPS_PER_CARD = 6;

/** A stop further than this from the last one belongs on a different trip. */
export const MAX_LEG_METRES = 6000;

/** Average urban travel speed used to budget a leg, in km/h. */
const TRAVEL_SPEED_KMH = 18;

/** On-site minutes budgeted per category. Rough, and labelled as such. */
const ON_SITE_MINUTES: Record<string, number> = {
  roads: 45,
  garbage: 20,
  water: 40,
  streetlights: 25,
  infrastructure: 50,
};

/** What a crew must photograph at each stop, so the trip is not wasted. */
const CAPTURE_REQUIREMENT: Record<string, string> = {
  roads: 'Wide shot of the patched surface plus one close-up of the joint.',
  garbage: 'Cleared site with the bin visible in frame.',
  water: 'Repaired joint or desilted node, with water flow visible.',
  streetlights: 'Pole number plate and the lit fixture after dark if possible.',
  infrastructure: 'Full structure plus the repaired section.',
};

function travelMinutes(metres: number): number {
  return Math.max(1, Math.round((metres / 1000 / TRAVEL_SPEED_KMH) * 60));
}

function coordsOf(complaint: Complaint): LatLng {
  return { latitude: complaint.location.latitude, longitude: complaint.location.longitude };
}

/**
 * Ranking used to pick the FIRST stop, and to break ties afterwards.
 *
 * Safety and SLA dominate: a breached critical job is the anchor of the
 * trip even if it is the furthest away. Proximity decides the order of
 * everything after that, which is where the saving actually comes from.
 */
function urgencyRank(complaint: Complaint, now: number): number {
  const health = computeSlaHealth(complaint, now);
  const priority = complaint.aiAnalysis?.priorityScore ?? 70;

  let rank = priority;
  if (health?.status === 'exceeded') rank += 40;
  else if (health?.status === 'approaching') rank += 20;
  if (complaint.status === 'escalated') rank += 30;
  if (detectRepeatFailure(complaint)) rank += 15;

  return rank;
}

function toStop(
  complaint: Complaint,
  sequence: number,
  legMetres: number,
  now: number
): WorkCardStop {
  const health = computeSlaHealth(complaint, now);
  const category = complaint.issue.category;
  const asset = assetForComplaint(complaint);

  return {
    sequence,
    complaintId: complaint.id,
    title: complaint.issue.title,
    category,
    locality: complaint.location.locality,
    address: complaint.location.address,
    coordinates: coordsOf(complaint),
    legMetres,
    estimatedMinutes: travelMinutes(legMetres) + (ON_SITE_MINUTES[category] ?? 30),
    slaStatus: health?.status ?? 'normal',
    slaLabel: health?.headline ?? 'No SLA target set',
    priorityScore: complaint.aiAnalysis?.priorityScore ?? 70,
    captureRequirement:
      CAPTURE_REQUIREMENT[category] ?? 'Clear photo of the completed work on site.',
    assetId: asset?.id,
    isRepeatFailure: detectRepeatFailure(complaint) !== null,
  };
}

export interface BuildCardOptions {
  departmentId: DepartmentId;
  /** Open, assigned complaints the department could dispatch today. */
  complaints: Complaint[];
  /** Depot or office the crew starts from. Defaults to the city centre. */
  startsFrom?: { latitude: number; longitude: number; label: string };
  maxStops?: number;
  assignedTo?: string;
  assignedStaffId?: string;
  now?: number;
}

/**
 * Builds one routed trip from the most urgent unrouted job outward.
 *
 * Greedy nearest-neighbour: anchor on the most urgent job, then
 * repeatedly take the closest remaining job of the same department
 * within `MAX_LEG_METRES`. Not optimal — nearest-neighbour never is —
 * but it is explainable to the crew driving it, which matters more here
 * than the last 8% of a tour length.
 */
export function buildWorkCard(options: BuildCardOptions): WorkCard | null {
  const now = options.now ?? Date.now();
  const maxStops = options.maxStops ?? MAX_STOPS_PER_CARD;

  const base = options.startsFrom ?? {
    latitude: defaultCity.coordinates.lat,
    longitude: defaultCity.coordinates.lng,
    label: `${DEPARTMENTS[options.departmentId]?.shortName ?? 'Department'} depot`,
  };

  const pool = options.complaints
    .filter((c) => c.status !== 'resolved')
    .filter((c) => typeof c.location?.latitude === 'number');

  if (pool.length === 0) return null;

  // Anchor: the single most urgent job. Safety leads the trip.
  const sorted = [...pool].sort((a, b) => urgencyRank(b, now) - urgencyRank(a, now));
  const route: Complaint[] = [sorted[0]];
  const remaining = new Set(sorted.slice(1));

  while (route.length < maxStops && remaining.size > 0) {
    const from = coordsOf(route[route.length - 1]);

    let nearest: Complaint | null = null;
    let nearestMetres = Infinity;

    for (const candidate of remaining) {
      const d = distanceMetres(from, coordsOf(candidate));
      if (d < nearestMetres) {
        nearest = candidate;
        nearestMetres = d;
      }
    }

    // Nothing left within a sensible leg. Ending the card here is
    // correct: a seventh stop 14 km away is a second trip pretending
    // to be one.
    if (!nearest || nearestMetres > MAX_LEG_METRES) break;

    route.push(nearest);
    remaining.delete(nearest);
  }

  return assembleCard(route, base, options, now);
}

function assembleCard(
  route: Complaint[],
  base: { latitude: number; longitude: number; label: string },
  options: BuildCardOptions,
  now: number
): WorkCard {
  const stops: WorkCardStop[] = [];
  let cursor: LatLng = base;
  let totalDistance = 0;

  route.forEach((complaint, index) => {
    const leg = distanceMetres(cursor, coordsOf(complaint));
    totalDistance += leg;
    stops.push(toStop(complaint, index + 1, leg, now));
    cursor = coordsOf(complaint);
  });

  // Return leg. A day is a loop, not a one-way trip, and a saving that
  // ignores the drive home is not a saving.
  totalDistance += distanceMetres(cursor, base);

  // The counterfactual: one trip per complaint, out from base and back.
  // This is what the department does today, and it is what the card is
  // measured against.
  const naiveDistance = route.reduce(
    (sum, c) => sum + distanceMetres(base, coordsOf(c)) * 2,
    0
  );

  const estimatedMinutes = stops.reduce((sum, s) => sum + s.estimatedMinutes, 0) +
    travelMinutes(distanceMetres(cursor, base));

  const forDate = new Date(now).toISOString().slice(0, 10);

  return {
    id: `WC-${options.departmentId.toUpperCase().slice(0, 3)}-${forDate.replace(/-/g, '')}-${stops.length}`,
    departmentId: options.departmentId,
    forDate,
    createdAt: new Date(now).toISOString(),
    assignedTo: options.assignedTo,
    assignedStaffId: options.assignedStaffId,
    status: options.assignedTo ? 'dispatched' : 'draft',
    stops,
    totalDistanceMetres: Math.round(totalDistance),
    estimatedMinutes,
    naiveDistanceMetres: Math.round(naiveDistance),
    savedMetres: Math.max(0, Math.round(naiveDistance - totalDistance)),
    skill: dominantSkill(route),
    startsFrom: base,
  };
}

/** The category most of the trip is about — what the crew must be equipped for. */
function dominantSkill(route: Complaint[]): string {
  const counts = new Map<string, number>();
  for (const c of route) {
    counts.set(c.issue.category, (counts.get(c.issue.category) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixed';
}

/**
 * Builds every card needed to cover a department's open work.
 *
 * Cards are cut by skill first, then by geography inside each skill. A
 * crew carrying hot-mix asphalt should not be sent to change a bulb, so
 * mixing categories to shave a kilometre is a false economy.
 */
export function buildDailyCards(
  departmentId: DepartmentId,
  complaints: Complaint[],
  now: number = Date.now()
): WorkCard[] {
  const bySkill = new Map<string, Complaint[]>();
  for (const c of complaints) {
    if (c.status === 'resolved') continue;
    const list = bySkill.get(c.issue.category) ?? [];
    list.push(c);
    bySkill.set(c.issue.category, list);
  }

  const cards: WorkCard[] = [];

  for (const [, group] of bySkill) {
    let pool = group;
    // Bounded: a pathological data set must not spin here.
    let guard = 0;
    while (pool.length > 0 && guard < 20) {
      guard += 1;
      const card = buildWorkCard({ departmentId, complaints: pool, now });
      if (!card || card.stops.length === 0) break;

      cards.push(card);
      const routed = new Set(card.stops.map((s) => s.complaintId));
      pool = pool.filter((c) => !routed.has(c.id));
    }
  }

  // Most urgent card first: the one whose first stop is furthest past SLA.
  return cards.sort((a, b) => {
    const rank = (card: WorkCard) =>
      card.stops[0]?.slaStatus === 'exceeded' ? 2 : card.stops[0]?.slaStatus === 'approaching' ? 1 : 0;
    return rank(b) - rank(a) || b.savedMetres - a.savedMetres;
  });
}

/** Trip-level saving, for the line the department head actually cares about. */
export function summariseSaving(cards: WorkCard[]): {
  trips: number;
  stops: number;
  savedMetres: number;
  savedMinutes: number;
} {
  const stops = cards.reduce((sum, c) => sum + c.stops.length, 0);
  const savedMetres = cards.reduce((sum, c) => sum + c.savedMetres, 0);

  return {
    trips: cards.length,
    stops,
    savedMetres,
    savedMinutes: travelMinutes(savedMetres),
  };
}
