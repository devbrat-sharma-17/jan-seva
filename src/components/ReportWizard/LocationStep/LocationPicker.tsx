import { useState } from 'react';
import type { GPSLocation, ConfirmedLocation } from '../../../types/report';
import { GWALIOR_LOCALITIES, reverseGeocode } from '../../../services/locationService';
import { CivicMap, type CivicMapMarker } from '../../shared/CivicMap/CivicMap';

const GWALIOR_CENTRE: [number, number] = [26.2183, 78.1828];

interface LocationPickerProps {
  gpsLocation: GPSLocation | null;
  confirmedLocation: ConfirmedLocation | null;
  onSelectLocality?: (locality: ConfirmedLocation) => void;
  interactive?: boolean;
}

export function LocationPicker({
  gpsLocation,
  confirmedLocation,
  onSelectLocality,
  interactive = false,
}: LocationPickerProps) {
  const [resolving, setResolving] = useState(false);

  const isDifferent =
    gpsLocation &&
    confirmedLocation &&
    confirmedLocation.source === 'manual' &&
    (Math.abs(gpsLocation.latitude - confirmedLocation.latitude) > 0.0001 ||
      Math.abs(gpsLocation.longitude - confirmedLocation.longitude) > 0.0001);

  const center: [number, number] = confirmedLocation
    ? [confirmedLocation.latitude, confirmedLocation.longitude]
    : gpsLocation
    ? [gpsLocation.latitude, gpsLocation.longitude]
    : GWALIOR_CENTRE;

  const markers: CivicMapMarker[] = [];
  if (gpsLocation) {
    markers.push({
      id: 'gps',
      lat: gpsLocation.latitude,
      lng: gpsLocation.longitude,
      tone: 'gps',
      title: 'Your current position',
    });
  }
  if (confirmedLocation) {
    markers.push({
      id: 'issue',
      lat: confirmedLocation.latitude,
      lng: confirmedLocation.longitude,
      tone: 'issue',
      title: 'Issue location',
      draggable: interactive && !!onSelectLocality,
    });
  }

  const handleDragEnd = async (_id: string, lat: number, lng: number) => {
    if (!onSelectLocality) return;
    setResolving(true);
    try {
      const resolved = await reverseGeocode(lat, lng);
      onSelectLocality(resolved);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="loc-picker-container">
      {/* Real slippy map (OpenStreetMap / CARTO tiles) */}
      <div className="loc-picker-map" aria-label="Interactive civic map">
        <CivicMap
          center={center}
          zoom={confirmedLocation || gpsLocation ? 15 : 12}
          scrollWheelZoom={false}
          zoomPosition="topright"
          attributionPosition="bottomleft"
          ariaLabel="Issue location map"
          markers={markers}
          onMarkerDragEnd={handleDragEnd}
        />

        {/* Quick-pick landmarks stay as an overlay above the map */}
        {interactive && (
          <div className="loc-picker-landmarks">
            {GWALIOR_LOCALITIES.slice(0, 4).map((loc) => {
              const isSelected = confirmedLocation?.locality === loc.locality;
              return (
                <button
                  key={loc.locality}
                  type="button"
                  className={`loc-map-landmark-btn ${isSelected ? 'loc-map-landmark-btn--selected' : ''}`}
                  onClick={() =>
                    onSelectLocality?.({
                      latitude: loc.lat,
                      longitude: loc.lng,
                      address: loc.address,
                      locality: loc.locality,
                      city: 'Gwalior',
                      state: 'Madhya Pradesh',
                      source: 'manual',
                      confirmedAt: new Date().toISOString(),
                    })
                  }
                >
                  <span className="loc-map-landmark-dot" />
                  <span>{loc.locality}</span>
                </button>
              );
            })}
          </div>
        )}

        {interactive && onSelectLocality && (
          <div className="loc-picker-hint">
            {resolving ? 'Locating address…' : 'Drag the orange pin to fine-tune'}
          </div>
        )}

        {/* Coordinates Badge */}
        <div className="loc-picker-badge">
          {confirmedLocation
            ? `Issue: ${confirmedLocation.latitude.toFixed(4)}, ${confirmedLocation.longitude.toFixed(4)}`
            : gpsLocation
            ? `GPS: ${gpsLocation.latitude.toFixed(4)}, ${gpsLocation.longitude.toFixed(4)}`
            : 'Gwalior, MP'}
        </div>
      </div>

      {/* Subtle Location Comparison when Manual differs from Device GPS */}
      {isDifferent && gpsLocation && confirmedLocation && (
        <div className="loc-comparison-card">
          <div className="loc-comparison-col">
            <span className="loc-comparison-tag loc-comparison-tag--gps">CURRENT LOCATION</span>
            <p className="loc-comparison-title">📍 You are here</p>
            <span className="loc-comparison-coords">
              {gpsLocation.latitude.toFixed(4)}, {gpsLocation.longitude.toFixed(4)}
            </span>
          </div>

          <div className="loc-comparison-divider" />

          <div className="loc-comparison-col">
            <span className="loc-comparison-tag loc-comparison-tag--issue">ISSUE LOCATION</span>
            <p className="loc-comparison-title">📍 {confirmedLocation.locality}</p>
            <span className="loc-comparison-coords">
              {confirmedLocation.latitude.toFixed(4)}, {confirmedLocation.longitude.toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
