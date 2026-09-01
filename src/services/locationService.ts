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
 * Attempts real browser GPS geolocation with graceful fallback, 
 * using OpenStreetMap Nominatim API for reverse geocoding.
 */
export async function detectCurrentLocation(
  cityName: string = 'Gwalior',
  stateName: string = 'Madhya Pradesh'
): Promise<LocationDetectionResult> {
  return new Promise((resolve) => {
    const fallbackLat = 26.2056;
    const fallbackLng = 78.2053;
    const detectedAt = new Date().toISOString();

    const resolveWithFallback = () => {
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
    };

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const timeoutId = setTimeout(() => resolveWithFallback(), 5000);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          clearTimeout(timeoutId);
          const { latitude, longitude, accuracy } = position.coords;
          
          try {
            // Use Nominatim for reverse geocoding
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            
            const locality = data.address?.suburb || data.address?.neighbourhood || data.address?.road || 'Unknown Locality';
            const city = data.address?.city || data.address?.county || cityName;
            const state = data.address?.state || stateName;
            const pincode = data.address?.postcode || 'Unknown';
            const address = data.display_name || `${locality}, ${city}`;

            resolve({
              gps: {
                latitude,
                longitude,
                accuracy: accuracy || 10,
                detectedAt,
                address,
                locality,
                city,
                state,
              },
              address,
              locality,
              city,
              state,
              pincode,
            });
          } catch (e) {
            // Fallback if API fails but we have GPS coordinates
            resolve({
              gps: {
                latitude,
                longitude,
                accuracy: accuracy || 10,
                detectedAt,
                address: `Detected Location, ${cityName}`,
                locality: 'Detected Locality',
                city: cityName,
                state: stateName,
              },
              address: `Detected Location, ${cityName}`,
              locality: 'Detected Locality',
              city: cityName,
              state: stateName,
              pincode: 'Unknown',
            });
          }
        },
        (_error) => {
          clearTimeout(timeoutId);
          resolveWithFallback();
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    } else {
      resolveWithFallback();
    }
  });
}

/**
 * Matches coordinates to real address using OpenStreetMap API.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  cityName: string = 'Gwalior',
  stateName: string = 'Madhya Pradesh'
): Promise<ConfirmedLocation> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    
    const locality = data.address?.suburb || data.address?.neighbourhood || data.address?.road || 'Unknown Locality';
    const city = data.address?.city || data.address?.county || cityName;
    const state = data.address?.state || stateName;
    const pincode = data.address?.postcode || '474001';
    const address = data.display_name || `${locality}, ${city}`;

    return {
      latitude: lat,
      longitude: lng,
      address,
      locality,
      city,
      state,
      pincode,
      source: 'manual',
      confirmedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      latitude: lat,
      longitude: lng,
      address: `Selected Location, ${cityName}`,
      locality: 'Selected Locality',
      city: cityName,
      state: stateName,
      pincode: '474001',
      source: 'manual',
      confirmedAt: new Date().toISOString(),
    };
  }
}

/**
 * Searches localities using OpenStreetMap Nominatim Search API.
 */
export async function searchLocalities(
  query: string,
  cityName: string = 'Gwalior',
  stateName: string = 'Madhya Pradesh'
): Promise<ConfirmedLocation[]> {
  const q = query.trim();

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

  try {
    // Append city to make search more relevant
    const searchQuery = encodeURIComponent(`${q}, ${cityName}`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${searchQuery}&addressdetails=1&limit=5`);
    const data = await res.json();

    if (!data || data.length === 0) {
      // Fallback to offline matches if API returns nothing
      const matches = GWALIOR_LOCALITIES.filter(
        (item) =>
          item.locality.toLowerCase().includes(q.toLowerCase()) ||
          item.address.toLowerCase().includes(q.toLowerCase()) ||
          item.landmark.toLowerCase().includes(q.toLowerCase())
      );
      
      if (matches.length > 0) {
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

    return data.map((item: any) => {
      const locality = item.address?.suburb || item.address?.neighbourhood || item.address?.road || q;
      const city = item.address?.city || item.address?.county || cityName;
      const state = item.address?.state || stateName;
      
      return {
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        address: item.display_name,
        locality,
        city,
        state,
        source: 'manual',
        confirmedAt: new Date().toISOString(),
      };
    });
  } catch (e) {
    return [];
  }
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
