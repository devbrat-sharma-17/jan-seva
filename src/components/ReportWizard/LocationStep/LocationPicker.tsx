import type { GPSLocation, ConfirmedLocation } from '../../../types/report';
import { GWALIOR_LOCALITIES } from '../../../services/locationService';

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
  const isDifferent =
    gpsLocation &&
    confirmedLocation &&
    confirmedLocation.source === 'manual' &&
    (Math.abs(gpsLocation.latitude - confirmedLocation.latitude) > 0.0001 ||
      Math.abs(gpsLocation.longitude - confirmedLocation.longitude) > 0.0001);

  return (
    <div className="loc-picker-container">
      {/* Map Surface */}
      <div className="loc-picker-map" aria-label="Interactive Civic Map Preview">
        {/* Animated Road Network Grid */}
        <div className="loc-picker-grid" />

        {/* Major Landmarks in Gwalior on Map */}
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

        {/* GPS Device Location Pin (Blue Radar Pulse) */}
        {gpsLocation && (
          <div className="loc-gps-pin-marker" title="Device GPS Position">
            <div className="loc-gps-pulse-ring" />
            <div className="loc-gps-center-dot" />
            {isDifferent && <span className="loc-pin-label">You</span>}
          </div>
        )}

        {/* Issue Location Pin (Orange / Red Civic Pin) */}
        {confirmedLocation && (
          <div
            className={`loc-issue-pin-marker ${isDifferent ? 'loc-issue-pin-marker--offset' : ''}`}
            title="Confirmed Issue Location"
          >
            <div className="loc-issue-pin-bubble">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            {isDifferent && <span className="loc-pin-label loc-pin-label--issue">Issue</span>}
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
