// ============================================================
// Geo Service — one implementation of the distance maths
// ============================================================
// Haversine was written out separately in the duplicate detector, and was
// about to be written a third and fourth time for asset snapping and work
// card routing. Four copies of a formula drift. This is the only one.

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle metres between two coordinates. */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

/**
 * Perpendicular distance from a point to a road SEGMENT, not to its
 * midpoint. A 300 m stretch of road whose centroid is 150 m away is still
 * the right asset for a pothole at either end, and centroid distance
 * would reject it.
 *
 * Uses an equirectangular projection, which is accurate to well under a
 * metre at the scale of a city block and far cheaper than the alternative.
 */
export function distanceToSegmentMetres(point: LatLng, a: LatLng, b: LatLng): number {
  const latRef = toRad((a.latitude + b.latitude) / 2);
  const project = (p: LatLng) => ({
    x: toRad(p.longitude) * Math.cos(latRef) * EARTH_RADIUS_M,
    y: toRad(p.latitude) * EARTH_RADIUS_M,
  });

  const P = project(point);
  const A = project(a);
  const B = project(b);

  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const lengthSquared = abx * abx + aby * aby;

  // A degenerate segment is a point.
  if (lengthSquared === 0) return distanceMetres(point, a);

  // Clamped projection parameter: 0 is endpoint A, 1 is endpoint B.
  const t = Math.max(0, Math.min(1, ((P.x - A.x) * abx + (P.y - A.y) * aby) / lengthSquared));
  const dx = P.x - (A.x + t * abx);
  const dy = P.y - (A.y + t * aby);

  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

/**
 * Snaps a coordinate to a ~110 m grid cell.
 *
 * Used to answer "did these reports come from meaningfully different
 * places?" without storing or comparing exact coordinates. Three decimal
 * places of latitude is roughly 111 m; the same at Gwalior's longitude is
 * roughly 100 m. Close enough for a spread measure, and deliberately
 * coarse so the key cannot be reversed into a doorstep.
 */
export function locationCell(point: LatLng, precision = 3): string {
  return `${point.latitude.toFixed(precision)},${point.longitude.toFixed(precision)}`;
}

/** Centroid of a set of points. Returns null for an empty set. */
export function centroidOf(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  const sum = points.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 }
  );
  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
}

/** "180 m" / "1.4 km" — for a stop list a crew reads while driving. */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
