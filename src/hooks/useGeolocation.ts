import { useState, useCallback } from 'react';
import {
  detectCurrentLocation,
  reverseGeocodeMock,
  searchLocalities,
  createDualLocationData,
  getLocationAccuracyLabel,
} from '../services/locationService';
import type { LocationData, GPSLocation, ConfirmedLocation } from '../types/report';

export function useGeolocation(cityName: string = 'Gwalior', stateName: string = 'Madhya Pradesh') {
  const [loading, setLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<GPSLocation | null>(null);
  const [confirmedLocation, setConfirmedLocation] = useState<ConfirmedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [searchResults, setSearchResults] = useState<ConfirmedLocation[]>([]);
  const [searching, setSearching] = useState(false);

  /**
   * Automatically attempts GPS detection.
   */
  const detectGPS = useCallback(async (): Promise<{
    gps: GPSLocation;
    defaultConfirmed: ConfirmedLocation;
    dual: LocationData;
  } | null> => {
    setLoading(true);
    setError(null);
    setPermissionDenied(false);

    try {
      const res = await detectCurrentLocation(cityName, stateName);
      setGpsLocation(res.gps);

      const defaultConfirmed: ConfirmedLocation = {
        latitude: res.gps.latitude,
        longitude: res.gps.longitude,
        address: res.address,
        locality: res.locality,
        city: res.city,
        state: res.state,
        pincode: res.pincode,
        source: 'gps',
        confirmedAt: new Date().toISOString(),
      };

      const dual = createDualLocationData(res.gps, defaultConfirmed);
      return { gps: res.gps, defaultConfirmed, dual };
    } catch {
      setError('Unable to retrieve your GPS location automatically.');
      setPermissionDenied(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, [cityName, stateName]);

  /**
   * Citizen chooses "USE DETECTED LOCATION".
   */
  const confirmGPSAsIssueLocation = useCallback((): LocationData | null => {
    if (!gpsLocation) return null;

    const confirmed: ConfirmedLocation = {
      latitude: gpsLocation.latitude,
      longitude: gpsLocation.longitude,
      address: gpsLocation.address || `Near City Centre, ${cityName}`,
      locality: gpsLocation.locality || 'City Centre',
      city: cityName,
      state: stateName,
      pincode: '474011',
      source: 'gps',
      confirmedAt: new Date().toISOString(),
    };

    setConfirmedLocation(confirmed);
    return createDualLocationData(gpsLocation, confirmed);
  }, [gpsLocation, cityName, stateName]);

  /**
   * Citizen chooses a manual location from search or map picker.
   */
  const confirmManualIssueLocation = useCallback(
    (manual: ConfirmedLocation): LocationData => {
      const confirmedWithSource: ConfirmedLocation = {
        ...manual,
        source: 'manual',
        confirmedAt: new Date().toISOString(),
      };
      setConfirmedLocation(confirmedWithSource);
      return createDualLocationData(gpsLocation, confirmedWithSource);
    },
    [gpsLocation]
  );

  /**
   * Searches known Gwalior localities & landmarks.
   */
  const searchAddress = useCallback(
    async (query: string) => {
      setSearching(true);
      try {
        const results = await searchLocalities(query, cityName, stateName);
        setSearchResults(results);
        return results;
      } finally {
        setSearching(false);
      }
    },
    [cityName, stateName]
  );

  const accuracyInfo = getLocationAccuracyLabel(gpsLocation?.accuracy);

  return {
    loading,
    gpsLocation,
    confirmedLocation,
    error,
    permissionDenied,
    searchResults,
    searching,
    accuracyInfo,
    detectGPS,
    confirmGPSAsIssueLocation,
    confirmManualIssueLocation,
    searchAddress,
    reverseGeocodeMock,
    setGpsLocation,
    setConfirmedLocation,
  };
}
