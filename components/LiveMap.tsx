'use client';
import { useEffect, useRef, useState } from 'react';

export interface Aircraft {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number;
  latitude: number;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;   // knots
  trueTrack: number | null;  // degrees, 0=north
  verticalRate: number | null;
}

interface Props {
  aircraft: Aircraft[];
  onSelect: (a: Aircraft) => void;
  selected: Aircraft | null;
  pollInterval?: number; // ms between data polls, default 15000
}

function altColor(ft: number | null): string {
  if (ft === null || ft === 0) return '#10b981';
  if (ft < 5000) return '#10b981';
  if (ft < 15000) return '#3b82f6';
  if (ft < 25000) return '#8b5cf6';
  if (ft < 35000) return '#f59e0b';
  return '#ef4444';
}

function makeSvg(color: string, angleDeg: number, isSelected: boolean): string {
  const s = isSelected ? 20 : 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24"
    style="transform:rotate(${angleDeg}deg);filter:drop-shadow(0 0 ${isSelected ? 5 : 2}px ${color})">
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"
      fill="${color}" stroke="${isSelected ? '#fff' : 'transparent'}" stroke-width="1"/>
  </svg>`;
}

// Knots + heading → lat/lon velocity (degrees per second)
function deadReckonVelocity(kts: number, headingDeg: number, lat: number) {
  const rads = headingDeg * Math.PI / 180;
  const degPerSecLat = (kts / 3600) / 60; // 1 kts = 1 nmi/hr = 1/60 deg lat/hr
  const degPerSecLon = degPerSecLat / Math.cos(lat * Math.PI / 180);
  return { vLat: degPerSecLat * Math.cos(rads), vLon: degPerSecLon * Math.sin(rads) };
}

export default function LiveMap({ aircraft, onSelect, selected, pollInterval = 15000 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  // Smooth position state per aircraft
  type PosState = { lat: number; lon: number; track: number; alt: number | null; kts: number; lastUpdate: number; onGround: boolean };
  const posRef = useRef<Map<string, PosState>>(new Map());
  const rafRef = useRef<number>(0);

  // Stable refs for callbacks
  const aircraftRef = useRef<Aircraft[]>([]);
  const selectedRef = useRef<Aircraft | null>(null);
  const onSelectRef = useRef<(a: Aircraft) => void>(onSelect);
  aircraftRef.current = aircraft;
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  // Init Leaflet map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    import('leaflet').then(L => {
      leafletRef.current = L;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      const map = L.map(mapRef.current!, { center: [40, -30], zoom: 4, zoomControl: true });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);
    });
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstanceRef.current as any).remove();
        mapInstanceRef.current = null;
        markersRef.current.clear();
        posRef.current.clear();
      }
    };
  }, []);

  // Merge incoming aircraft data into smooth position state
  useEffect(() => {
    const now = Date.now();
    aircraft.forEach(ac => {
      if (!ac.longitude || !ac.latitude) return;
      const prev = posRef.current.get(ac.icao24);
      if (prev) {
        // Blend toward new reported position over half the poll interval
        posRef.current.set(ac.icao24, {
          ...prev,
          track: ac.trueTrack ?? prev.track,
          alt: ac.baroAltitude,
          kts: ac.velocity ?? prev.kts,
          onGround: ac.onGround,
          lastUpdate: now,
        });
      } else {
        posRef.current.set(ac.icao24, {
          lat: ac.latitude,
          lon: ac.longitude,
          track: ac.trueTrack ?? 0,
          alt: ac.baroAltitude,
          kts: ac.velocity ?? 0,
          onGround: ac.onGround,
          lastUpdate: now,
        });
      }
    });
  }, [aircraft]);

  // RAF animation loop — runs once map is ready
  useEffect(() => {
    if (!mapReady) return;
    const L = leafletRef.current!;
    const map = mapInstanceRef.current as ReturnType<typeof L.map>;
    const existing = markersRef.current;
    let lastFrame = Date.now();

    function tick() {
      const now = Date.now();
      const dt = (now - lastFrame) / 1000; // seconds since last frame
      lastFrame = now;

      const currentAircraft = aircraftRef.current;
      const seen = new Set<string>();

      // Dead-reckon each aircraft forward by dt seconds
      posRef.current.forEach((pos) => {
        if (pos.onGround || pos.kts <= 0) return;
        const { vLat, vLon } = deadReckonVelocity(pos.kts, pos.track, pos.lat);
        pos.lat += vLat * dt;
        pos.lon += vLon * dt;
      });

      currentAircraft.forEach(ac => {
        if (!ac.longitude || !ac.latitude) return;
        const key = ac.icao24;
        seen.add(key);

        const pos = posRef.current.get(key);
        if (!pos) return;

        // Smoothly lerp reported position back in (correct drift over ~5s)
        const alpha = Math.min(dt / 5, 0.1);
        pos.lat += (ac.latitude - pos.lat) * alpha;
        pos.lon += (ac.longitude - pos.lon) * alpha;

        const isSelected = selectedRef.current?.icao24 === key;
        const color = altColor(pos.alt);
        const size = isSelected ? 20 : 14;
        const svg = makeSvg(color, pos.track, isSelected);
        const icon = L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

        if (existing.has(key)) {
          const marker = existing.get(key) as ReturnType<typeof L.marker>;
          marker.setLatLng([pos.lat, pos.lon]);
          marker.setIcon(icon);
        } else {
          const marker = L.marker([pos.lat, pos.lon], { icon })
            .addTo(map)
            .on('click', () => onSelectRef.current(ac));
          existing.set(key, marker);
        }
      });

      // Remove stale markers
      existing.forEach((marker, key) => {
        if (!seen.has(key)) {
          (marker as ReturnType<typeof L.marker>).remove();
          existing.delete(key);
          posRef.current.delete(key);
        }
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapReady]);


  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
    </>
  );
}
