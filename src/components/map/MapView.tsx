'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import { publicPhotoUrl } from '@/lib/storage';
import type { MapPhoto } from '@/lib/supabase/queries';

// Pure-CSS marker so we don't have to ship leaflet's PNG icon files.
const dotIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#ededed;border:2px solid #0a0a0a;box-shadow:0 0 0 1px #ededed,0 2px 6px rgba(0,0,0,.5)"></div>',
  iconSize:    [14, 14],
  iconAnchor:  [7, 7],
  popupAnchor: [0, -10],
});

interface Props {
  photos: MapPhoto[];
}

// Group photos by rounded coordinates so a single museum doesn't render N
// stacked markers — we render one marker per location with a list inside.
function groupByLocation(photos: MapPhoto[]) {
  const groups = new Map<string, { lat: number; lng: number; photos: MapPhoto[] }>();
  for (const p of photos) {
    const key = `${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
    const existing = groups.get(key);
    if (existing) existing.photos.push(p);
    else groups.set(key, { lat: p.lat, lng: p.lng, photos: [p] });
  }
  return Array.from(groups.values());
}

export function MapView({ photos }: Props) {
  if (photos.length === 0) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-md border border-dashed border-zinc-800 text-sm text-zinc-500">
        No geocoded photos yet. Run <code className="rounded bg-zinc-900 px-1.5 py-0.5">scripts/geocode.mjs</code> first.
      </div>
    );
  }

  const groups = groupByLocation(photos);

  // Center on the centroid of all groups.
  const center: [number, number] = [
    groups.reduce((s, g) => s + g.lat, 0) / groups.length,
    groups.reduce((s, g) => s + g.lng, 0) / groups.length,
  ];

  return (
    <div className="h-[75vh] overflow-hidden rounded-md border border-zinc-800">
      <MapContainer
        center={center}
        zoom={3}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />
        {groups.map((g) => (
          <Marker key={`${g.lat}|${g.lng}`} position={[g.lat, g.lng]} icon={dotIcon}>
            <Popup>
              <div style={{ maxWidth: 220 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
                  {g.photos[0].location_taken}
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {g.photos.map((p) => (
                    <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={publicPhotoUrl(p.thumbnail_path ?? p.storage_path)}
                        alt={p.vehicle_name}
                        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }}
                      />
                      <Link
                        href={`/?photo=${p.vehicle_id}`}
                        style={{ fontSize: 13, color: '#0a0a0a', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {p.vehicle_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
