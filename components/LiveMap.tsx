'use client';
import { useEffect, useRef } from 'react';

interface Aircraft {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number;
  latitude: number;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  trueTrack: number | null;
  verticalRate: number | null;
}

interface Props {
  aircraft: Aircraft[];
  onSelect: (a: Aircraft) => void;
  selected: Aircraft | null;
}

function altColor(ft: number | null): string {
  if (ft === null || ft === 0) return '#10b981';
  if (ft < 5000) return '#10b981';
  if (ft < 15000) return '#3b82f6';
  if (ft < 25000) return '#8b5cf6';
  if (ft < 35000) return '#f59e0b';
  return '#ef4444';
}

export default function LiveMap({ aircraft, onSelect, selected }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Dynamically import Leaflet (client-only)
    import('leaflet').then(L => {
      // Fix default marker icons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [40, -30],
        zoom: 4,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      leafletMap.current = map;
    });

    return () => {
      if (leafletMap.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (leafletMap.current as any).remove();
        leafletMap.current = null;
        markersRef.current.clear();
      }
    };
  }, []);

  // Update markers when aircraft changes
  useEffect(() => {
    if (!leafletMap.current) return;

    import('leaflet').then(L => {
      const map = leafletMap.current as ReturnType<typeof L.map>;
      const existing = markersRef.current;
      const seen = new Set<string>();

      aircraft.forEach(ac => {
        if (!ac.longitude || !ac.latitude) return;
        const key = ac.icao24;
        seen.add(key);

        const color = altColor(ac.baroAltitude);
        const angle = ac.trueTrack ?? 0;
        const isSelected = selected?.icao24 === ac.icao24;
        const size = isSelected ? 20 : 14;

        // SVG plane icon rotated by heading
        const planeSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
               style="transform:rotate(${angle}deg);filter:drop-shadow(0 0 3px ${color})">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"
                  fill="${color}" stroke="${isSelected ? '#fff' : 'transparent'}" stroke-width="1"/>
          </svg>`;

        const icon = L.divIcon({
          html: planeSvg,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        if (existing.has(key)) {
          const marker = existing.get(key) as ReturnType<typeof L.marker>;
          marker.setLatLng([ac.latitude, ac.longitude]);
          marker.setIcon(icon);
        } else {
          const marker = L.marker([ac.latitude, ac.longitude], { icon })
            .addTo(map)
            .on('click', () => onSelect(ac));
          existing.set(key, marker);
        }
      });

      // Remove stale markers
      existing.forEach((marker, key) => {
        if (!seen.has(key)) {
          (marker as ReturnType<typeof L.marker>).remove();
          existing.delete(key);
        }
      });
    });
  }, [aircraft, selected, onSelect]);

  return (
    <>
      {/* Leaflet CSS */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
    </>
  );
}
