// Build public/world-110m.geojson — the map page's basemap.
//
// Why we self-host an outline instead of using tiles: CARTO's free raster
// basemaps started requiring an API key and are being retired, and every hosted
// alternative either needs a key or runs on someone else's bandwidth. A 110m
// Natural Earth outline (public domain) is ~73KB gzipped from our own origin:
// no key, no rate limit, nothing that can be withdrawn. The trade is no street
// detail, which a world map of museum pins never needed.
//
// Run with:
//   node scripts/build-world-geojson.mjs
//
// Source: world-atlas@2 (TopoJSON of Natural Earth 110m), fetched at build time
// so no vendored blob sits in git history.

import { writeFileSync } from 'node:fs';

const SOURCE = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const OUT = 'public/world-110m.geojson';
const PRECISION = 4; // ~11m — far finer than a 110m outline actually resolves

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`fetch ${SOURCE}: ${res.status} ${res.statusText}`);
const topo = await res.json();

// --- TopoJSON 1.0 decode -----------------------------------------------------
// Arcs are delta-encoded integers; a linear transform maps them back to lon/lat.
const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;

const arcs = topo.arcs.map((deltas) => {
  let x = 0, y = 0;
  return deltas.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * sx + tx, y * sy + ty];
  });
});

// A negative index means "traverse arc ~i backwards". Joined arcs share an
// endpoint, so the duplicate is dropped before concatenating.
const joinArcs = (idxs) => idxs.reduce((pts, i) => {
  const arc = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
  return pts.length ? pts.concat(arc.slice(1)) : arc.slice();
}, []);

// --- Antimeridian handling ---------------------------------------------------
// Russia and Fiji are stored as rings that wrap across ±180°. Drawn as-is on a
// flat Leaflet canvas the step from +179 to -179 reads as a line straight back
// across the map, smearing each into a horizontal band.
//
// Unwrapping alone is not enough. It removes the false step but leaves the ring
// sitting outside [-180, 180], and emitting a shifted duplicate to compensate
// gives one feature a 523°-wide footprint — which Leaflet paints as a single
// SVG path under fill-rule: evenodd, so the overlapping copies cancel and wash
// the ocean grey. Instead, unwrap and then genuinely CLIP each ring into the
// 360° windows it touches, shifting every piece back into [-180, 180]. Russia
// comes out as two ordinary polygons — the mainland and Chukotka — with no
// coordinate out of range and no overlap for evenodd to cancel.
function unwrap(ring) {
  let turns = 0;
  return ring.map((pt, i) => {
    if (i > 0) {
      const delta = pt[0] - ring[i - 1][0];
      if (delta > 180) turns -= 1;
      else if (delta < -180) turns += 1;
    }
    return [pt[0] + turns * 360, pt[1]];
  });
}

// Sutherland-Hodgman against one vertical line. A 360° window is convex, so
// clipping to it is exact: two half-plane passes, no general polygon clipper.
function clipHalf(pts, bound, keepLeft) {
  const inside = (p) => (keepLeft ? p[0] <= bound : p[0] >= bound);
  const cross = (a, b) => {
    const t = (bound - a[0]) / (b[0] - a[0]);
    return [bound, a[1] + t * (b[1] - a[1])];
  };

  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const prev = pts[(i - 1 + pts.length) % pts.length];
    if (inside(cur)) {
      if (!inside(prev)) out.push(cross(prev, cur));
      out.push(cur);
    } else if (inside(prev)) {
      out.push(cross(prev, cur));
    }
  }
  return out;
}

function clipToWindow(ring, centre) {
  // Drop the closing duplicate; the clipper treats input as implicitly closed.
  const open = ring.slice(0, -1);
  let out = clipHalf(open, centre - 180, false);
  if (out.length) out = clipHalf(out, centre + 180, true);
  if (out.length < 3) return null;
  return [...out.map(([lon, lat]) => [lon - centre, lat]), [out[0][0] - centre, out[0][1]]];
}

const lonSpan = (ring) => {
  const lons = ring.map((p) => p[0]);
  return Math.max(...lons) - Math.min(...lons);
};

// Split one polygon (outer ring + holes) into as many in-range polygons as the
// antimeridian demands. A ring that never wraps yields exactly one, unchanged.
function splitPolygon(rings) {
  const [outer, ...holes] = rings.map(unwrap);
  const lons = outer.map((p) => p[0]);
  const first = Math.floor((Math.min(...lons) + 180) / 360);
  const last = Math.floor((Math.max(...lons) + 180) / 360);

  const polys = [];
  for (let k = first; k <= last; k++) {
    const centre = k * 360;
    const clippedOuter = clipToWindow(outer, centre);
    if (!clippedOuter) continue;
    const clippedHoles = holes.map((h) => clipToWindow(h, centre)).filter(Boolean);
    polys.push([clippedOuter, ...clippedHoles]);
  }
  return polys;
}

// --- Assemble ----------------------------------------------------------------
// Antarctica is dropped. It does not cross the seam — it encircles the pole, so
// its ring legitimately spans the full 360° and no unwrapping can help. Web
// Mercator renders it as a featureless bar pinned across the bottom of the
// canvas, and the gallery has no pins south of Cape Town, so it is pure noise.
const SKIP = new Set(['Antarctica']);

const features = [];

for (const g of topo.objects.countries.geometries) {
  if (SKIP.has(g.properties?.name)) continue;
  const polys = g.type === 'Polygon'
    ? [g.arcs.map(joinArcs)]
    : g.arcs.map((rings) => rings.map(joinArcs));

  const fixed = polys.flatMap(splitPolygon);

  features.push({
    type: 'Feature',
    // Only the name survives — nothing else is rendered, and dropping the rest
    // roughly halves the payload.
    properties: { name: g.properties?.name ?? '' },
    geometry: { type: 'MultiPolygon', coordinates: fixed },
  });
}

const round = (n) => Number(n.toFixed(PRECISION));
for (const f of features) {
  f.geometry.coordinates = f.geometry.coordinates.map((poly) =>
    poly.map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)])));
}

const json = JSON.stringify({ type: 'FeatureCollection', features });
writeFileSync(OUT, json);

// --- Verify ------------------------------------------------------------------
// A silent regression here is invisible until someone loads the map, so assert
// the two properties that actually matter before declaring success.
const reparsed = JSON.parse(json);
let smeared = 0, points = 0, outOfRange = 0;

for (const f of reparsed.features) {
  for (const poly of f.geometry.coordinates) {
    for (const ring of poly) {
      if (lonSpan(ring) > 180) {
        smeared += 1;
        console.error(`  ✗ ${f.properties.name}: ring still spans >180°`);
      }
      for (const [lon, lat] of ring) {
        points += 1;
        if (!Number.isFinite(lon) || !Number.isFinite(lat)
            || Math.abs(lon) > 180.01 || Math.abs(lat) > 90.5) {
          outOfRange += 1;
        }
      }
    }
  }
}

if (smeared || outOfRange) {
  throw new Error(`${smeared} smeared ring(s), ${outOfRange} bad coordinate(s)`);
}

console.log(`${OUT}: ${reparsed.features.length} countries, ${points} points, ` +
            `${(json.length / 1024).toFixed(1)} KB`);
console.log('no rings span >180°; every coordinate within [-180,180] x [-90,90]');
