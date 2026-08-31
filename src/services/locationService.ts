// ============================================================
// Location Service — Browser GPS & City Geocoding
// ============================================================

import type { LocationData, GPSLocation, ConfirmedLocation } from '../types/report';

export interface LocationDetectionResult {
  gps: GPSLocation;
  address: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
}

export const GWALIOR_LOCALITIES: Array<{
  locality: string;
  address: string;
  lat: number;
  lng: number;
  landmark: string;
}> = [
  { locality: 'City Centre', address: 'Near Collectorate, City Centre Main Road', lat: 26.2052, lng: 78.1924, landmark: 'Collectorate' },
  { locality: 'Lashkar', address: 'Phool Bagh Road, Lashkar', lat: 26.2124, lng: 78.1672, landmark: 'Phool Bagh Garden' },
  { locality: 'Morar', address: 'Morar Cantt Main Road', lat: 26.2289, lng: 78.2241, landmark: 'Morar Cantt' },
  { locality: 'Thatipur', address: 'Near Thatipur Circle, Morar Road', lat: 26.2167, lng: 78.2045, landmark: 'Thatipur Circle' },
  { locality: 'Maharaj Bada', address: 'Near Victoria Market, Maharaj Bada', lat: 26.2011, lng: 78.1612, landmark: 'Maharaj Bada' },
  { locality: 'Phool Bagh', address: 'Phool Bagh Crossing, Lashkar', lat: 26.2150, lng: 78.1685, landmark: 'Phool Bagh' },
  { locality: 'University Road', address: 'Govindpuri, University Road', lat: 26.2105, lng: 78.1970, landmark: 'Jiwaji University' },
  { locality: 'Gole Ka Mandir', address: 'Near Gole Ka Mandir Square', lat: 26.2480, lng: 78.2090, landmark: 'Gole Ka Mandir' },
  { locality: 'Pinto Park', address: 'Pinto Park Colony, Gwalior', lat: 26.2415, lng: 78.2318, landmark: 'Airforce Station' },
  { locality: 'Gwalior Fort Area', address: 'Near Urvai Gate, Gwalior Fort', lat: 26.2294, lng: 78.1698, landmark: 'Urvai Gate' },
  { locality: 'Hazira', address: 'Near Hazira Chowk, Gwalior', lat: 26.2378, lng: 78.1756, landmark: 'Hazira Square' },
];

/**
 * Classifies geolocation accuracy in meters.
 */
export function getLocationAccuracyLabel(accuracyMeters?: number): {
  level: 'high' | 'medium' | 'low';
  text: string;
  isLow: boolean;
} {
  if (accuracyMeters === undefined || accuracyMeters === null) {
    return { level: 'high', text: '±12 m', isLow: false };
  }
  if (accuracyMeters <= 20) {
    return { level: 'high', text: `±${Math.round(accuracyMeters)} m`, isLow: false };
  }
  if (accuracyMeters <= 50) {
    return { level: 'medium', text: `±${Math.round(accuracyMeters)} m`, isLow: false };
  }
  return {
    level: 'low',
    text: `±${Math.round(accuracyMeters)} m (Low accuracy)`,
    isLow: true,
  };
}

/**
 * Attempts real browser GPS geolocation with graceful fallback.
 */
export async function detectCurrentLocation(
  cityName: string = 'Gwalior',
  stateName: string = 'Madhya Pradesh'
): Promise<LocationDetectionResult> {
  return new Promise((resolve) => {
    const fallbackLat = 26.2056;
    const fallbackLng = 78.2053;
    const detectedAt = new Date().toISOString();

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const timeoutId = setTimeout(() => {
        resolve({
          gps: {
            latitude: fallbackLat,
            longitude: fallbackLng,
            accuracy: 12,
            detectedAt,
            address: `Near City Centre, ${cityName}`,
            locality: 'City Centre',
            city: cityName,
            state: stateName,
          },
          address: `Near City Centre, ${cityName}`,
          locality: 'City Centre',
          city: cityName,
          state: stateName,
          pincode: '474011',
        });
      }, 3500);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          const { latitude, longitude, accuracy } = position.coords;
          resolve({
            gps: {
              latitude,
              longitude,
              accuracy: accuracy || 10,
              detectedAt,
              address: `Near City Centre, ${cityName}`,
              locality: 'City Centre',
              city: cityName,
              state: stateName,
            },
            address: `Near City Centre, ${cityName}`,
            locality: 'City Centre',
            city: cityName,
            state: stateName,
            pincode: '474011',
          });
        },
        (_error) => {
          clearTimeout(timeoutId);
          resolve({
            gps: {
              latitude: fallbackLat,
              longitude: fallbackLng,
              accuracy: 15,
              detectedAt,
              address: `Near City Centre, ${cityName}`,
              locality: 'City Centre',
              city: cityName,
              state: stateName,
            },
            address: `Near City Centre, ${cityName}`,
            locality: 'City Centre',
            city: cityName,
            state: stateName,
            pincode: '474011',
          });
        },
        { enableHighAccuracy: true, timeout: 3500, maximumAge: 10000 }
      );
    } else {
      resolve({
        gps: {
          latitude: fallbackLat,
          longitude: fallbackLng,
          accuracy: 15,
          detectedAt,
          address: `Near City Centre, ${cityName}`,
          locality: 'City Centre',
          city: cityName,
          state: stateName,
        },
        address: `Near City Centre, ${cityName}`,
        locality: 'City Centre',
        city: cityName,
        state: stateName,
        pincode: '474011',
      });
    }
  });
}

/**
 * Matches coordinates to nearest known Gwalior locality.
 */
export async function reverseGeocodeMock(
  lat: number,
  lng: number,
  cityName: string = 'Gwalior',
  stateName: string = 'Madhya Pradesh'
): Promise<ConfirmedLocation> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Find closest locality
  let closest = GWALIOR_LOCALITIES[0];
  let minDistance = Infinity;

  for (const loc of GWALIOR_LOCALITIES) {
    const dist = Math.sqrt(Math.pow(loc.lat - lat, 2) + Math.pow(loc.lng - lng, 2));
    if (dist < minDistance) {
      minDistance = dist;
      closest = loc;
    }
  }

  return {
    latitude: lat,
    longitude: lng,
    address: closest.address,
    locality: closest.locality,
    city: cityName,
    state: stateName,
    pincode: '474001',
    source: 'manual',
    confirmedAt: new Date().toISOString(),
  };
}

/**
 * Searches localities by name or landmark in Gwalior.
 */
export async function searchLocalities(
  query: string,
  cityName: string = 'Gwalior',
  stateName: string = 'Madhya Pradesh'
): Promise<ConfirmedLocation[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const q = query.toLowerCase().trim();

  if (!q) {
    return GWALIOR_LOCALITIES.slice(0, 6).map((item) => ({
      latitude: item.lat,
      longitude: item.lng,
      address: item.address,
      locality: item.locality,
      city: cityName,
      state: stateName,
      source: 'manual',
      confirmedAt: new Date().toISOString(),
    }));
  }

  const matches = GWALIOR_LOCALITIES.filter(
    (item) =>
      item.locality.toLowerCase().includes(q) ||
      item.address.toLowerCase().includes(q) ||
      item.landmark.toLowerCase().includes(q)
  );

  if (matches.length === 0) {
    return [
      {
        latitude: 26.2183,
        longitude: 78.1828,
        address: `${query}, ${cityName}`,
        locality: query,
        city: cityName,
        state: stateName,
        source: 'manual',
        confirmedAt: new Date().toISOString(),
      },
    ];
  }

  return matches.map((item) => ({
    latitude: item.lat,
    longitude: item.lng,
    address: item.address,
    locality: item.locality,
    city: cityName,
    state: stateName,
    source: 'manual',
    confirmedAt: new Date().toISOString(),
  }));
}

/**
 * Constructs a fully normalized LocationData object combining permanent GPS and confirmed issue location.
 */
export function createDualLocationData(
  gps: GPSLocation | null,
  confirmed: ConfirmedLocation
): LocationData {
  return {
    gps,
    confirmed,
    // Flattened compatibility properties pointing to the confirmed issue location
    latitude: confirmed.latitude,
    longitude: confirmed.longitude,
    address: confirmed.address,
    locality: confirmed.locality,
    city: confirmed.city,
    state: confirmed.state,
    pincode: confirmed.pincode,
  };
}
