import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReportPhoto } from '../../../types/report';
import './LiveCameraModal.css';

interface LiveCameraModalProps {
  onCapture: (photo: ReportPhoto) => void;
  onClose: () => void;
  onFallbackToFile: () => void;
}

export function LiveCameraModal({ onCapture, onClose, onFallbackToFile }: LiveCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  // Stop camera tracks
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Initialize Camera
  const startCamera = useCallback(async () => {
    stopStream();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported in this browser.');
      onFallbackToFile();
      return;
    }

    // Start fetching location in background
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          detectedAt: new Date().toISOString()
        }),
        () => console.warn("Could not get location for photo geotag"),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    try {
      // Check available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
      setCameraError('Unable to access device camera directly.');
      // Graceful fallback to native file capture
      setTimeout(() => {
        onFallbackToFile();
        onClose();
      }, 800);
    }
  }, [facingMode, stopStream, onFallbackToFile, onClose]);

  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  // Capture Frame
  const capturePhoto = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flash visual feedback immediately
    setIsFlashing(true);

    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    // After drawing the frame, quickly await GPS if we don't have it yet
    let loc = currentLocation;
    if (!loc && navigator.geolocation) {
      try {
        const pos: any = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 3000, maximumAge: 0 });
        });
        loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          detectedAt: new Date().toISOString()
        };
      } catch (err) {
        console.warn('Geotag fallback timeout', err);
      }
    }

    setTimeout(() => {
      const newPhoto: ReportPhoto = {
        id: `camera_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        url: dataUrl,
        name: `Civic_Photo_${new Date().toISOString().slice(0, 10)}.jpg`,
        timestamp: Date.now(),
        // This frame was drawn from the live MediaStream by the line above.
        captureMethod: 'LIVE_CAMERA',
        capturedAtClient: new Date().toISOString(),
        location: loc || undefined,
      };

      stopStream();
      onCapture(newPhoto);
      onClose();
    }, 50);
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="camera-modal-overlay" role="dialog" aria-modal="true" aria-label="Camera Viewfinder">
      {/* Top Bar */}
      <div className="camera-top-bar">
        <span className="camera-top-title">Live Camera</span>
        <button
          type="button"
          className="camera-close-btn"
          onClick={() => {
            stopStream();
            onClose();
          }}
          aria-label="Close camera"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Viewport */}
      <div className="camera-viewport">
        {cameraError ? (
          <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '20px' }}>
            <p>{cameraError}</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-gray-400)' }}>Opening device file selector...</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="camera-video-element"
            />
            {/* Viewfinder Overlay Reticle */}
            <div className="camera-target-reticle" />
            <span className="camera-hint-overlay">Align the issue inside the frame</span>
            {isFlashing && <div className="camera-flash-effect" />}
          </>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="camera-bottom-controls">
        <div className="camera-control-placeholder" />

        {/* Shutter Button */}
        <button
          type="button"
          className="camera-shutter-btn"
          onClick={capturePhoto}
          aria-label="Capture photo"
          id="btn-shutter-snap"
        >
          <div className="camera-shutter-inner" />
        </button>

        {/* Camera Flip Button */}
        {hasMultipleCameras ? (
          <button
            type="button"
            className="camera-flip-btn"
            onClick={toggleFacingMode}
            aria-label="Flip camera"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        ) : (
          <div className="camera-control-placeholder" />
        )}
      </div>
    </div>
  );
}
