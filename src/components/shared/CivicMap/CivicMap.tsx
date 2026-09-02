// ============================================================
// CivicMap — real interactive map (Leaflet + OpenStreetMap/CARTO tiles)
// ------------------------------------------------------------
// One reusable slippy-map surface for every "map section" in the
// app. Tiles come from the free CARTO basemap CDN (OpenStreetMap
// data), so there is no API key to configure. Markers are plain
// HTML div-icons, which sidesteps Leaflet's bundler icon issue.
// ============================================================

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './CivicMap.css';

export type CivicMapTone =
  | 'critical'
  | 'high'
  | 'medium'
  | 'resolved'
  | 'gps'
  | 'issue';

export interface CivicMapMarker {
  id: string;
  lat: number;
  lng: number;
  tone: CivicMapTone;
  title?: string;
  draggable?: boolean;
}

interface CivicMapProps {
  center: [number, number];
  zoom?: number;
  markers?: CivicMapMarker[];
  selectedId?: string | null;
  /** Auto-frame all markers whenever the set of marker ids changes. */
  fitToMarkers?: boolean;
  scrollWheelZoom?: boolean;
  basemap?: 'light' | 'dark';
  zoomPosition?: L.ControlPosition;
  attributionPosition?: L.ControlPosition;
  className?: string;
  ariaLabel?: string;
  onMarkerClick?: (id: string) => void;
  onMarkerDragEnd?: (id: string, lat: number, lng: number) => void;
}

const TILES: Record<'light' | 'dark', { url: string; attribution: string }> = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

const PIN_SVG =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

function buildIcon(tone: CivicMapTone, selected: boolean): L.DivIcon {
  if (tone === 'gps') {
    return L.divIcon({
      className: 'civic-marker',
      html: '<span class="civic-dot civic-dot--gps"><i class="civic-dot__pulse"></i></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }
  const cls = `civic-pin civic-pin--${tone}${selected ? ' civic-pin--selected' : ''}`;
  return L.divIcon({
    className: 'civic-marker',
    html: `<span class="${cls}">${PIN_SVG}</span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
  });
}

export function CivicMap({
  center,
  zoom = 13,
  markers,
  selectedId = null,
  fitToMarkers = false,
  scrollWheelZoom = true,
  basemap = 'light',
  zoomPosition = 'topleft',
  attributionPosition = 'bottomright',
  className,
  ariaLabel = 'Map',
  onMarkerClick,
  onMarkerDragEnd,
}: CivicMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fitKeyRef = useRef<string>('');

  // Callbacks are read through refs so the map is built exactly once.
  const clickRef = useRef(onMarkerClick);
  const dragRef = useRef(onMarkerDragEnd);
  clickRef.current = onMarkerClick;
  dragRef.current = onMarkerDragEnd;

  // ---- build the map once -------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: false,
      scrollWheelZoom,
      attributionControl: false,
    });

    L.control.zoom({ position: zoomPosition }).addTo(map);
    L.control.attribution({ position: attributionPosition, prefix: false }).addTo(map);

    const tile = TILES[basemap];
    tileRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // The container often measures 0px on the first paint (tab panels,
    // flex parents); recalculating once layout settles avoids grey tiles.
    const raf = requestAnimationFrame(() => map.invalidateSize());

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      layerRef.current = null;
      fitKeyRef.current = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- swap tiles when the basemap changes ------------------------------
  useEffect(() => {
    if (tileRef.current) tileRef.current.setUrl(TILES[basemap].url);
  }, [basemap]);

  // ---- (re)draw markers ------------------------------------------------
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    layer.clearLayers();
    (markers ?? [])
      .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
      .forEach((m) => {
        const marker = L.marker([m.lat, m.lng], {
          icon: buildIcon(m.tone, m.id === selectedId),
          draggable: !!m.draggable,
          title: m.title,
          keyboard: false,
          zIndexOffset:
            m.id === selectedId ? 1000 : m.tone === 'issue' ? 400 : m.tone === 'gps' ? 200 : 0,
        });
        marker.on('click', () => clickRef.current?.(m.id));
        if (m.draggable) {
          marker.on('dragend', () => {
            const { lat, lng } = marker.getLatLng();
            dragRef.current?.(m.id, lat, lng);
          });
        }
        marker.addTo(layer);
      });
  }, [markers, selectedId]);

  // ---- keep the viewport in sync -------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const pts = (markers ?? []).filter(
      (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng),
    );

    if (fitToMarkers && pts.length > 0) {
      const key = pts
        .map((p) => p.id)
        .sort()
        .join('|');
      if (key !== fitKeyRef.current) {
        fitKeyRef.current = key;
        map.fitBounds(
          L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])),
          { padding: [50, 50], maxZoom: 15 },
        );
      }
    } else if (!fitToMarkers) {
      map.setView(center, zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, fitToMarkers, center[0], center[1], zoom]);

  return (
    <div
      ref={containerRef}
      className={`civic-map${className ? ` ${className}` : ''}`}
      role="application"
      aria-label={ariaLabel}
    />
  );
}
