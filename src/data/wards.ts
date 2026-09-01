// ============================================================
// Ward profiles — Gwalior
// ============================================================
//
//   READ THIS BEFORE QUOTING ANY NUMBER BELOW.
//
// These figures are ILLUSTRATIVE. Population is scaled to plausible
// Gwalior ward sizes; the connectivity and literacy indices are stand-ins
// for the covariates a real Ward Reality Index would need (census ward
// tables, device-penetration data, prior reporting rates).
//
// They exist to demonstrate the CORRECTION — that raw complaint volume
// is not a measure of conditions — not to measure Gwalior. Every screen
// that consumes them says so. Presenting a confident equity claim built
// on invented covariates would be worse than showing no equity claim at
// all, which is precisely why the audit ranked this idea as Phase 6.
//
// Evidence the correction is needed, rather than a nicety:
//   "Equity in 311 Reporting: Understanding Socio-Spatial Differentials
//    in the Propensity to Complain"
//   "Bias in smart city governance: How socio-spatial disparities in 311
//    complaint behavior impact the fairness of data-driven decisions"

import type { WardProfile } from '../types/field';

export const GWALIOR_WARDS: WardProfile[] = [
  {
    id: 'W-03',
    name: 'Maharaj Bada',
    zone: 'Central',
    population: 41200,
    connectivityIndex: 0.58,
    literacyIndex: 0.71,
    centroid: { latitude: 26.2011, longitude: 78.1612 },
    localities: ['Maharaj Bada'],
  },
  {
    id: 'W-05',
    name: 'Fort & Urvai',
    zone: 'West',
    population: 28600,
    connectivityIndex: 0.44,
    literacyIndex: 0.63,
    centroid: { latitude: 26.2294, longitude: 78.1698 },
    localities: ['Gwalior Fort Area'],
  },
  {
    id: 'W-08',
    name: 'Lashkar & Phool Bagh',
    zone: 'Central',
    population: 52400,
    connectivityIndex: 0.72,
    literacyIndex: 0.79,
    centroid: { latitude: 26.2130, longitude: 78.1676 },
    localities: ['Lashkar', 'Phool Bagh'],
  },
  {
    id: 'W-11',
    name: 'University Road',
    zone: 'Central',
    population: 34800,
    connectivityIndex: 0.86,
    literacyIndex: 0.91,
    centroid: { latitude: 26.2105, longitude: 78.1970 },
    localities: ['University Road'],
  },
  {
    id: 'W-14',
    name: 'City Centre',
    zone: 'Central',
    population: 47900,
    connectivityIndex: 0.88,
    literacyIndex: 0.88,
    centroid: { latitude: 26.2060, longitude: 78.1880 },
    localities: ['City Centre'],
  },
  {
    id: 'W-17',
    name: 'Hazira',
    zone: 'North',
    population: 38500,
    connectivityIndex: 0.51,
    literacyIndex: 0.66,
    centroid: { latitude: 26.2378, longitude: 78.1756 },
    localities: ['Hazira'],
  },
  {
    id: 'W-19',
    name: 'Thatipur',
    zone: 'East',
    population: 44300,
    connectivityIndex: 0.79,
    literacyIndex: 0.83,
    centroid: { latitude: 26.2180, longitude: 78.2060 },
    localities: ['Thatipur'],
  },
  {
    id: 'W-22',
    name: 'Morar',
    zone: 'East',
    population: 56100,
    connectivityIndex: 0.68,
    literacyIndex: 0.76,
    centroid: { latitude: 26.2280, longitude: 78.2220 },
    localities: ['Morar'],
  },
  {
    id: 'W-27',
    name: 'Maharajpura',
    zone: 'South',
    population: 33700,
    connectivityIndex: 0.39,
    literacyIndex: 0.58,
    centroid: { latitude: 26.1981, longitude: 78.2345 },
    localities: ['Maharajpura'],
  },
  {
    id: 'W-31',
    name: 'Gole Ka Mandir',
    zone: 'North',
    population: 40900,
    connectivityIndex: 0.62,
    literacyIndex: 0.72,
    centroid: { latitude: 26.2480, longitude: 78.2090 },
    localities: ['Gole Ka Mandir'],
  },
  {
    id: 'W-33',
    name: 'Pinto Park',
    zone: 'North',
    population: 26400,
    connectivityIndex: 0.47,
    literacyIndex: 0.64,
    centroid: { latitude: 26.2415, longitude: 78.2318 },
    localities: ['Pinto Park'],
  },
];

/** Which ward a locality string belongs to. Null for anything unmapped. */
export function wardForLocality(locality: string): WardProfile | null {
  const needle = locality.trim().toLowerCase();
  return (
    GWALIOR_WARDS.find((w) => w.localities.some((l) => l.toLowerCase() === needle)) ?? null
  );
}

export function getWardById(id: string): WardProfile | undefined {
  return GWALIOR_WARDS.find((w) => w.id === id);
}
