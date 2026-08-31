import React, { useEffect, useState } from 'react';
import type { LocationData, ConfirmedLocation } from '../../../types/report';
import { useGeolocation } from '../../../hooks/useGeolocation';
import { useCityConfig } from '../../../hooks/useCityConfig';
import { LocationPicker } from './LocationPicker';
import './LocationStep.css';

interface LocationStepProps {
  location: LocationData | null;
  onLocationChange: (loc: LocationData) => void;
}

export function LocationStep({ location, onLocationChange }: LocationStepProps) {
  const city = useCityConfig();
  const {
    loading,
    gpsLocation,
    confirmedLocation,
    error,
    permissionDenied,
    searchResults,
    accuracyInfo,
    detectGPS,
    confirmGPSAsIssueLocation,
    confirmManualIssueLocation,
    searchAddress,
    setGpsLocation,
    setConfirmedLocation,
  } = useGeolocation(city.name, city.state);

  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasAttemptedGPS, setHasAttemptedGPS] = useState(false);

  // Sync initial location from draft if already populated
  useEffect(() => {
    if (location) {
      if (location.gps) setGpsLocation(location.gps);
      if (location.confirmed) setConfirmedLocation(location.confirmed);
      else if (location.latitude && location.longitude) {
        setConfirmedLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          locality: location.locality,
          city: location.city,
          state: location.state,
          pincode: location.pincode,
          source: 'gps',
          confirmedAt: new Date().toISOString(),
        });
      }
    }
  }, [location, setGpsLocation, setConfirmedLocation]);

  // Initial automatic GPS detection on mount
  useEffect(() => {
    if (!hasAttemptedGPS && !location?.gps && !location?.confirmed) {
      setHasAttemptedGPS(true);
      detectGPS();
    }
  }, [hasAttemptedGPS, location, detectGPS]);

  // Citizen chooses "USE DETECTED LOCATION"
  const handleUseDetectedLocation = () => {
    const dual = confirmGPSAsIssueLocation();
    if (dual) {
      onLocationChange(dual);
      setIsChangingLocation(false);
    }
  };

  // Citizen selects a manual locality
  const handleSelectManualLocality = (item: ConfirmedLocation) => {
    const dual = confirmManualIssueLocation(item);
    onLocationChange(dual);
    setIsChangingLocation(false);
    setSearchQuery('');
  };

  const handleManualSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    searchAddress(q);
  };

  const activeConfirmed = confirmedLocation || location?.confirmed || null;
  const activeGps = gpsLocation || location?.gps || null;


  return (
    <div className="location-step">
      {/* Title & Core Philosophy */}
      <div className="step-heading">
        <h2 className="step-heading__title">Where is the issue?</h2>
        <p className="step-heading__subtitle">
          We’ll detect your current location and let you confirm where the issue actually is.
        </p>
      </div>

      {/* State 1: Detecting GPS State */}
      {loading && !activeGps && !activeConfirmed && (
        <div className="loc-detecting-card">
          <div className="loc-pulse-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <h3 className="loc-detecting-text">Detecting your location...</h3>
            <p className="loc-detecting-sub">Fetching GPS coordinates for {city.name}</p>
          </div>
        </div>
      )}

      {/* State 2: GPS Permission Denied / Error State */}
      {!loading && !activeGps && !activeConfirmed && (permissionDenied || error) && !isChangingLocation && (
        <div className="loc-denied-card">
          <div className="loc-denied-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h3 className="loc-denied-title">LOCATION ACCESS UNAVAILABLE</h3>
          <p className="loc-denied-desc">
            We couldn't access your current location. You can try again or easily select your locality manually.
          </p>

          <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '360px' }}>
            <button
              type="button"
              className="report-btn report-btn--secondary"
              onClick={() => detectGPS()}
              style={{ flex: 1 }}
            >
              TRY AGAIN
            </button>
            <button
              type="button"
              className="report-btn report-btn--primary"
              onClick={() => {
                setIsChangingLocation(true);
                searchAddress('');
              }}
              style={{ flex: 1.4 }}
              id="btn-enter-location-manually"
            >
              ENTER MANUALLY
            </button>
          </div>
        </div>
      )}

      {/* State 3: GPS Detected (Citizen Confirmation Prompt) */}
      {!loading && activeGps && !activeConfirmed && !isChangingLocation && (
        <div className="loc-prompt-container">
          {/* GPS Detection Card */}
          <div className="loc-detected-card">
            <div className="loc-detected-header">
              <span className="loc-detected-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                LOCATION DETECTED
              </span>
              <span className="loc-accuracy-tag">Accuracy: {accuracyInfo.text}</span>
            </div>

            <h3 className="loc-detected-address">📍 {activeGps.address || `Near City Centre, ${city.name}`}</h3>

            <div className="loc-gps-coords-row">
              <span className="loc-gps-label">Device GPS:</span>
              <span className="loc-gps-val">
                {activeGps.latitude.toFixed(4)}, {activeGps.longitude.toFixed(4)}
              </span>
            </div>

            {accuracyInfo.isLow && (
              <div className="loc-low-accuracy-banner">
                <span>⚠ Location accuracy is low. We recommend confirming or adjusting the locality below.</span>
              </div>
            )}
          </div>

          {/* Issue Location Confirmation Question */}
          <div className="loc-confirm-question-card">
            <h4 className="loc-confirm-question-title">WHERE EXACTLY IS THE ISSUE?</h4>
            <div className="loc-confirm-preview-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--blue-500)', flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{activeGps.address || `Near City Centre, ${city.name}`}</span>
            </div>

            <p className="loc-confirm-question-sub">
              You can adjust the location if the issue is not exactly where you are standing.
            </p>

            <div className="loc-confirm-btn-row">
              <button
                type="button"
                className="report-btn report-btn--primary"
                onClick={handleUseDetectedLocation}
                id="btn-use-detected-location"
              >
                <span>USE DETECTED LOCATION</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>

              <button
                type="button"
                className="report-btn report-btn--secondary"
                onClick={() => {
                  setIsChangingLocation(true);
                  searchAddress('');
                }}
                id="btn-change-enter-location"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <span>CHANGE / ENTER LOCATION</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State 4: Location Confirmed Card (Ready to Continue) */}
      {!loading && activeConfirmed && !isChangingLocation && (
        <div className="loc-confirmed-container">
          <div className="loc-card">
            {/* Map Preview */}
            <LocationPicker
              gpsLocation={activeGps}
              confirmedLocation={activeConfirmed}
            />

            {/* Address & Source Details */}
            <div className="loc-details-body">
              <div className="loc-confirmed-header-row">
                <span className="loc-status-tag">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  LOCATION CONFIRMED
                </span>

                <span className={`loc-source-badge loc-source-badge--${activeConfirmed.source}`}>
                  {activeConfirmed.source === 'gps' ? 'GPS DETECTED' : 'MANUALLY SELECTED'}
                </span>
              </div>

              <h3 className="loc-address-title">📍 {activeConfirmed.address || activeConfirmed.locality}</h3>
              <p className="loc-city-sub">
                {activeConfirmed.locality}, {activeConfirmed.city}, {activeConfirmed.state}
              </p>

              <div className="loc-coords-footer">
                <span>Issue Coordinates:</span>
                <code>
                  {activeConfirmed.latitude.toFixed(4)}, {activeConfirmed.longitude.toFixed(4)}
                </code>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="report-btn report-btn--secondary"
            onClick={() => {
              setIsChangingLocation(true);
              searchAddress('');
            }}
            id="btn-change-location"
            style={{ minHeight: '44px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <span>CHANGE LOCATION</span>
          </button>
        </div>
      )}

      {/* State 5: Manual Search & Map Selection Interface */}
      {isChangingLocation && (
        <div className="loc-search-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--slate-900)' }}>
              SEARCH LOCATION
            </h4>
            {(activeConfirmed || activeGps) && (
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--blue-600)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setIsChangingLocation(false)}
              >
                Cancel
              </button>
            )}
          </div>

          {/* Search Input Box */}
          <div className="loc-search-input-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slate-400)' }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="loc-search-input"
              placeholder="Search area, landmark or address (e.g. City Centre, Phool Bagh...)"
              value={searchQuery}
              onChange={handleManualSearchChange}
              autoFocus
            />
          </div>

          {/* Interactive Map Quick Landmarks */}
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.04em' }}>
              Select on map or tap a landmark:
            </span>
            <div style={{ marginTop: '8px' }}>
              <LocationPicker
                gpsLocation={activeGps}
                confirmedLocation={activeConfirmed}
                onSelectLocality={handleSelectManualLocality}
                interactive={true}
              />
            </div>
          </div>

          {/* Search Results List */}
          <div className="loc-results-list">
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="loc-result-item"
                onClick={() => handleSelectManualLocality(item)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <div className="loc-result-text">
                  <span className="loc-result-locality">{item.locality}</span>
                  <span className="loc-result-addr">{item.address}, {item.city}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Return to GPS Option */}
          {activeGps && (
            <button
              type="button"
              className="report-btn report-btn--outline"
              onClick={handleUseDetectedLocation}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
              <span>Use Current GPS Location</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
