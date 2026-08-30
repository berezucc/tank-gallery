'use client';

import { useEffect, useState } from 'react';
import { MapContainer, GeoJSON, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import type { FeatureCollection } from 'geojson';
import { publicPhotoUrl } from '@/lib/storage';
import type { MapPhoto } from '@/lib/supabase/queries';

// The basemap is a self-hosted 110m Natural Earth outline (public domain),
// not raster tiles. CARTO's free tile endpoint started requiring an API key and
// is being retired, and every hosted alternative either needs a key or leans on
// someone else's bandwidth. 73KB gzipped from our own origin has no key, no
// rate limit, and nothing that can be withdrawn. The trade is no street detail,
// which a world map of museum pins never needed — hence MAX_ZOOM below.
const WORLD_URL = '/world-110m.geojson';
const MAX_ZOOM = 7;

const LAND_STYLE = {
  fillColor: '#1f1f22',
  fillOpacity: 1,
  color: '#3a3a40',
  weight: 0.6,
} as const;

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
  // Kept out of the JS bundle and fetched once, so the browser and CDN cache it
  // like any other static asset instead of re-parsing it on every navigation.
  const [world, setWorld] = useState<FeatureCollection | null>(null);
  const [worldFailed, setWorldFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(WORLD_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((data: FeatureCollection) => { if (!cancelled) setWorld(data); })
      .catch(() => { if (!cancelled) setWorldFailed(true); });
    return () => { cancelled = true; };
  }, []);

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
        minZoom={2}
        maxZoom={MAX_ZOOM}
        maxBounds={[[-72, -200], [84, 200]]}
        maxBoundsViscosity={0.9}
        scrollWheelZoom
        worldCopyJump
        attributionControl={false}
        style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
      >
        {/* Markers stay usable if the outline ever fails to load, so the
            basemap is rendered only once it has actually arrived. */}
        {world && <GeoJSON data={world} style={() => LAND_STYLE} interactive={false} />}
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
      {worldFailed && (
        <div className="border-t border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
          Basemap outline failed to load — markers are still plotted.
        </div>
      )}
    </div>
  );
}
