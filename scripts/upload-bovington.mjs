// Upload the Bovington + Tyneham batch (29 Aug 2026) to Supabase.
//
// 205 photos across 84 subjects from The Tank Museum, Bovington, plus five
// landscape shots of range-target hulks on the Lulworth Ranges at Tyneham.
// Both location strings are matched by museums.ts (Bovington via
// match: ['tank museum', 'bovington']).
//
// Names come from the photo filenames, which carry the photographer's own rough
// labels, corrected against the exhibit placards visible in the frames and, for
// the WW1 tanks, against the museum's published collection. Where a placard was
// legible it wins; entries still resting on inference are listed in UNCERTAIN
// below so they can be corrected with a single UPDATE.
//
// Run with:
//   node --env-file=.env.local scripts/upload-bovington.mjs --dry-run
//   node --env-file=.env.local scripts/upload-bovington.mjs
//
// Safe to re-run: vehicles are matched by name, photos by storage path.

import { createClient } from '@supabase/supabase-js';
import { encode } from 'blurhash';
import sharp from 'sharp';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const SRC = '/Users/nikita/Downloads/New Folder With Items';
const BUCKET = 'photos';
const FULL_MAX = 2400;
const THUMB_MAX = 600;

// Best guesses, not placard-confirmed. Listed here rather than buried so they
// are easy to find and fix later.
const UNCERTAIN = {
  'WW1 Heavy Tank': 'nine frames from the Mark-series halls whose placards are not legible even at full resolution; hull numbers IC 15, 12007, D52 and B46 are visible and would settle them against the museum catalogue',
  'Medium Mark A Whippet': 'hull number A259 falls in the Whippet range; no placard in frame',
  'Mark IV Replica': 'placard reads REPLICA and the hull carries THE TANK MUSEUM lettering — built for the film War Horse',
  'Vickers Medium Mk II': 'hull number T1020, inferred from the layout',
  'Vickers Light Tank Mk VI': 'unlabelled frame; inferred from the twin-weapon turret',
  'Carden-Loyd Carrier': 'registration MT 9909 on an interwar display; type inferred from the open-topped tracked hull',
  'Cruiser Mk II (A10)': 'from the Battle for Greece display; the confirmed A9 is a separate exhibit',
  'Covenanter': 'hull number T9143, inferred from the turret and running gear',
  'Challenger 1': 'one frame placard-confirmed; the outdoor plinth tank grouped with it is inferred',
  'Challenger 2': 'inferred from the Iraq/Afghanistan display context',
  'Centurion': 'includes an "early turret" frame that may be a different mark, and IMG_2108 whose subject is under a tarpaulin and identified by the photographer rather than from the image',
  'T-55': 'includes a distant outdoor frame labelled "t55 recover" that may be an ARV rather than a gun tank',
};

// IMG_2108 shows a tarpaulin-covered hull behind a fence at distance, with
// nothing identifiable in frame. Filed under Centurion on the photographer's
// identification, not on anything visible in the photo.

const VEHICLES = [
  { name: "Little Willie", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["little willie?.HEIC"] },
  // The "mark 1s" group turned out to be several different vehicles. Re-reading
  // the frames at full resolution made the lectern placards legible, and they
  // disagree with the filenames — so the group is split on what the placards
  // actually say. The remainder keeps a plainly descriptive name rather than a
  // falsely precise one.
  { name: "Mark IV", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1948mark 1s.HEIC"] },
  { name: "Mark V", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1950mark 1s.HEIC"] },
  { name: "Medium Mark A Whippet", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1893.HEIC"] },
  { name: "Mark IV Replica", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["another mark I.HEIC"] },
  { name: "WW1 Heavy Tank", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1949mark 1s.HEIC", "IMG_1951mark 1s.HEIC", "IMG_1952mark 1s.HEIC", "IMG_1953mark 1s.HEIC", "IMG_1954mark 1s.HEIC", "IMG_1955mark 1s.HEIC", "IMG_1956mark 1s.HEIC", "IMG_1957mark 1s.HEIC", "inside mark.HEIC"] },
  { name: "Mark II Female - The Flying Scotsman", type: "tank", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["some mark tank idk.HEIC", "some mark tank idkk.HEIC"] },
  { name: "Renault FT-17", type: "tank", era: "ww1", nation: "France",
    location: "The Tank Museum, Bovington",
    files: ["renault ft17.HEIC"] },
  { name: "Rolls-Royce Armoured Car", type: "vehicle", era: "ww1", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["rolls royce armoured car.HEIC"] },
  { name: "Vickers Medium Mk I", type: "tank", era: "other", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["vickers mediu,.HEIC"] },
  { name: "Vickers Medium Mk II", type: "tank", era: "other", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["t1020 idk tank ww1?.HEIC"] },
  { name: "Vickers-Armstrongs Mark E", type: "tank", era: "other", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["vickers armsrong tnak.HEIC"] },
  { name: "Vickers Light Tank Mk VI", type: "tank", era: "other", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1899.HEIC"] },
  { name: "Light Tank Mk IIA", type: "tank", era: "other", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["light tank mark IIA.HEIC"] },
  { name: "Carden-Loyd Carrier", type: "vehicle", era: "other", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["mt9909, not sure.HEIC"] },
  { name: "Crossley-Chevrolet Armoured Car", type: "vehicle", era: "other", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["crossely chevrolet.HEIC"] },
  { name: "Crusader III", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["Crusader III!.HEIC"] },
  { name: "Daimler Dingo Scout Car", type: "vehicle", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["Dingp Scout Car.HEIC"] },
  { name: "Char B1 bis", type: "tank", era: "ww2", nation: "France",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1902char b2.HEIC", "IMG_1903char b2.HEIC", "char b2.HEIC"] },
  { name: "Somua S35", type: "tank", era: "ww2", nation: "France",
    location: "The Tank Museum, Bovington",
    files: ["somau s35.HEIC"] },
  { name: "Tiger 131", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1904tiger 1.HEIC", "IMG_1905tiger 1.HEIC", "IMG_1906tiger 1.HEIC", "IMG_1907tiger 1.HEIC", "IMG_1908tiger 1.HEIC", "IMG_1909tiger 1.HEIC", "IMG_1910tiger 1.HEIC"] },
  { name: "Tiger II", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2014Tiger II King Tiger.HEIC", "IMG_2015Tiger II King Tiger.HEIC", "IMG_2016Tiger II King Tiger.HEIC", "IMG_2017Tiger II King Tiger.HEIC", "IMG_2020Tiger II King Tiger.HEIC"] },
  { name: "Panther", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["panther.HEIC"] },
  { name: "Panzer I Command Tank", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["panzer I command.HEIC"] },
  { name: "Panzer II", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2009panzer II.HEIC", "IMG_2010panzer II.HEIC", "IMG_2011panzer II.HEIC", "IMG_2012panzer II.HEIC", "panzer 2.HEIC"] },
  { name: "Panzer III", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1913panzer 3.HEIC", "IMG_1914panzer 3.HEIC", "IMG_1994panzer III.HEIC", "IMG_1995panzer III.HEIC", "IMG_1996panzer III.HEIC"] },
  { name: "Panzer IV", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2031panzer IV.HEIC", "IMG_2032panzer IV.HEIC", "IMG_2033panzer IV.HEIC"] },
  { name: "StuG III", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2036stug III.HEIC", "IMG_2037stug III.HEIC", "IMG_2038stug III.HEIC", "IMG_2039stug III.HEIC", "IMG_2040stug III.HEIC"] },
  { name: "Jagdpanther", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2067jagdpanther.HEIC", "IMG_2068jagdpanther.HEIC", "IMG_2069jagdpanther.HEIC", "IMG_2070jagdpanther.HEIC", "IMG_2071jagdpanther.HEIC", "IMG_2072jagdpanther.HEIC"] },
  { name: "Jagdtiger", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2054jagdtiger.HEIC", "IMG_2056jagdtiger.HEIC", "IMG_2057jagdtiger.HEIC", "IMG_2058jagdtiger.HEIC", "IMG_2059jagdtiger.HEIC", "IMG_2060jagdtiger.HEIC", "IMG_2061jagdtiger.HEIC", "IMG_2062jagdtiger.HEIC", "IMG_2063jagdtiger.HEIC"] },
  { name: "Jagdpanzer 38 Hetzer", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2050hetzer.HEIC", "IMG_2051hetzer.HEIC"] },
  { name: "Nashorn", type: "tank", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1915nashron.HEIC", "IMG_1916nashron.HEIC", "IMG_1917nashron.HEIC"] },
  { name: "Sd Kfz 234/3", type: "vehicle", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2025Sd Kfz 234:3.HEIC", "IMG_2026Sd Kfz 234:3.HEIC"] },
  { name: "Sd Kfz 251", type: "vehicle", era: "ww2", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["Sd Kfz 251.HEIC"] },
  { name: "Cromwell", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1937cromwell.HEIC", "IMG_1938cromwell.HEIC"] },
  { name: "Comet", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1961comet.HEIC", "IMG_1962comet.HEIC", "IMG_1963comet.HEIC", "IMG_1964comet.HEIC", "IMG_1965comet.HEIC", "IMG_1966comet.HEIC"] },
  { name: "Churchill Mk VII", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1934churchill mk7.HEIC", "IMG_1935churchill mk7.HEIC"] },
  { name: "Churchill Mk IV", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2041Churchill IV.HEIC", "IMG_2042Churchill IV.HEIC", "IMG_2043Churchill IV.HEIC"] },
  { name: "Churchill Mk II", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["churchill II.HEIC"] },
  { name: "Churchill AVRE", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2006churchill AVRE.HEIC", "IMG_2007churchill AVRE.HEIC"] },
  { name: "Matilda I", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["another matilda I again.HEIC", "another matilda I.HEIC", "matidla .HEIC", "matilda 1.HEIC"] },
  { name: "Matilda II", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1978another matilda II.HEIC", "IMG_1979another matilda II.HEIC", "IMG_1980another matilda II.HEIC"] },
  { name: "Valentine", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["valentine.HEIC"] },
  { name: "Valentine Bridgelayer", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["Valentine Bridgelayer.HEIC"] },
  { name: "Valentine Archer", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["valentine archer.HEIC"] },
  { name: "Cruiser Mk I (A9)", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["a9 cruiser.HEIC"] },
  { name: "Cruiser Mk II (A10)", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1982battle for greece, some cruiser idk.HEIC", "IMG_1983battle for greece, some cruiser idk.HEIC"] },
  { name: "Covenanter", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["one of the cruiser tnaks.HEIC"] },
  { name: "Tetrarch", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["tetrach.HEIC"] },
  { name: "Centaur Dozer", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["centaur dozer.HEIC"] },
  { name: "Tortoise", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2079tortoise.HEIC", "IMG_2080tortoise.HEIC"] },
  { name: "TOG II", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2081tog II.HEIC", "IMG_2082tog II.HEIC", "tog II .HEIC"] },
  { name: "AEC Armoured Car", type: "vehicle", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["aec armour car.HEIC"] },
  { name: "Beaverette", type: "vehicle", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["beaverette.HEIC"] },
  { name: "Sherman Firefly", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["firefly.HEIC"] },
  { name: "M4 Sherman Crab", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["sherman crab.HEIC"] },
  { name: "M10 Achilles", type: "tank", era: "ww2", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2028m10 achilles.HEIC", "IMG_2029m10 achilles.HEIC", "IMG_2030m10 achilles.HEIC"] },
  { name: "M4A1 Sherman - Michael", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["another m4a1 sherman michael.HEIC", "m4a1 sherman.HEIC"] },
  { name: "M4A2E8 Sherman - Fury", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["fury sherman.HEIC", "sherman (FROM FURY PLEASE INCLUDE)\\.HEIC"] },
  { name: "M3 Lee", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1997m3 lee.HEIC", "IMG_1998m3 lee.HEIC"] },
  { name: "M3 Stuart", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1984m3 stuart.HEIC", "IMG_1985m3 stuart.HEIC", "IMG_1986m3 stuart.HEIC"] },
  { name: "M5 Stuart", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["m5 stuart.HEIC"] },
  { name: "M24 Chaffee", type: "tank", era: "ww2", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["another chaffee.HEIC", "chafee.HEIC", "chaffee.HEIC"] },
  { name: "Ram Mk II", type: "tank", era: "ww2", nation: "Canada",
    location: "The Tank Museum, Bovington",
    files: ["ram 2.HEIC"] },
  { name: "Ram Kangaroo", type: "vehicle", era: "ww2", nation: "Canada",
    location: "The Tank Museum, Bovington",
    files: ["ram kangarro.HEIC"] },
  { name: "T-34-76", type: "tank", era: "ww2", nation: "USSR",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1939finish capture t3476.HEIC", "IMG_1940finish capture t3476.HEIC"] },
  { name: "T-34-85", type: "tank", era: "ww2", nation: "USSR",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2064t3485.HEIC", "IMG_2065t3485.HEIC"] },
  { name: "Carro Veloce L3", type: "tank", era: "ww2", nation: "Italy",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1991Carro L3.HEIC", "IMG_1992Carro L3.HEIC", "IMG_1993Carro L3.HEIC"] },
  { name: "M14/41", type: "tank", era: "ww2", nation: "Italy",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1973m14:41.HEIC", "IMG_1975m14:41.HEIC", "IMG_1976m14:41.HEIC", "IMG_1977m14:41.HEIC"] },
  { name: "Type 95 Ha-Go", type: "tank", era: "ww2", nation: "Japan",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2003Ha-Go.HEIC", "IMG_2004Ha-Go.HEIC"] },
  { name: "Centurion", type: "tank", era: "cold_war", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1931centurion.HEIC", "IMG_1932centurion.HEIC", "IMG_1933centurion.HEIC", "early turret centurion.HEIC",
            "IMG_2108.HEIC"] },
  { name: "Centurion (Sectioned)", type: "tank", era: "cold_war", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2104cut apart centurion.HEIC", "IMG_2106cut apart centurion.HEIC"] },
  { name: "Conqueror", type: "tank", era: "cold_war", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2073conqueror.HEIC", "IMG_2074conqueror.HEIC"] },
  { name: "Chieftain", type: "tank", era: "cold_war", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["chieftan another.HEIC", "some chieftan.HEIC"] },
  { name: "FV432 Ambulance", type: "vehicle", era: "cold_war", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["idk some medical evac apc idk.HEIC"] },
  { name: "Challenger 1", type: "tank", era: "modern", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["another challenger 1 or 2 idk.HEIC", "challenger.HEIC"] },
  { name: "Challenger 2", type: "tank", era: "modern", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1924challenger.HEIC", "IMG_1925challenger.HEIC", "challenger II another.HEIC", "challenger II.HEIC"] },
  { name: "M48 Patton", type: "tank", era: "cold_war", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1928m48 patton.HEIC", "IMG_1929m48 patton.HEIC"] },
  { name: "M113", type: "vehicle", era: "cold_war", nation: "USA",
    location: "The Tank Museum, Bovington",
    files: ["m1113.HEIC"] },
  { name: "T-55", type: "tank", era: "cold_war", nation: "USSR",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2109some t55s.HEIC", "IMG_2110some t55s.HEIC", "another t55.HEIC", "t55 recover.HEIC", "t55s.HEIC"] },
  { name: "T-62", type: "tank", era: "cold_war", nation: "USSR",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1920t62.HEIC", "IMG_1921t62.HEIC", "IMG_1922t62.HEIC", "IMG_1923t62.HEIC"] },
  { name: "T-72", type: "tank", era: "cold_war", nation: "USSR",
    location: "The Tank Museum, Bovington",
    files: ["IMG_1926t72.HEIC", "IMG_1927t72.HEIC", "another t72.HEIC"] },
  { name: "Type 59", type: "tank", era: "cold_war", nation: "China",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2095type 59.HEIC", "IMG_2096type 59.HEIC"] },
  { name: "AMX-13", type: "tank", era: "cold_war", nation: "France",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2100amx 13.HEIC", "IMG_2101amx 13.HEIC", "IMG_2102amx 13.HEIC"] },
  { name: "Leopard 2", type: "tank", era: "modern", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["leopard2.HEIC"] },
  { name: "Marder 1 IFV", type: "vehicle", era: "cold_war", nation: "Germany",
    location: "The Tank Museum, Bovington",
    files: ["IMG_2086marder.HEIC", "IMG_2087marder.HEIC", "IMG_2088marder.HEIC"] },
  { name: "Tank Gun Barrels", type: "other", era: "other", nation: "UK",
    location: "The Tank Museum, Bovington",
    files: ["various cannons.HEIC"] },
  { name: "Range Target Hulks", type: "other", era: "other", nation: "UK",
    location: "Tyneham Range, Lulworth Ranges, Dorset",
    files: ["IMG_2134Tyneham Range.HEIC", "IMG_2135Tyneham Range.HEIC", "IMG_2136Tyneham Range.HEIC", "IMG_2137Tyneham Range.HEIC", "IMG_2160Tyneham Range.HEIC"] },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

globalThis.WebSocket = WebSocket;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Filenames here are the photographer's labels and get edited in place, so
// resolve exact-first and fall back to the IMG_NNNN prefix the label was
// appended to. Storage paths key off that stable number, never the label.
const DIR = readdirSync(SRC).filter((n) => /\.heic$/i.test(n));

function resolveSource(entry) {
  if (DIR.includes(entry)) return entry;
  const m = entry.match(/^(IMG_\d{4})/);
  if (m) {
    const hits = DIR.filter((n) => n.startsWith(m[1]));
    if (hits.length === 1) return hits[0];
  }
  throw new Error(`no file in ${SRC} matches "${entry}"`);
}

// Storage stem: the camera's number when present, otherwise a slug of the
// label. Either way it is stable across renames of the source file.
function storageStem(entry) {
  const m = entry.match(/^(IMG_\d{4})/);
  return m ? m[1].toLowerCase() : slugify(entry.replace(/\.heic$/i, ''));
}

function readExif(file) {
  try {
    const out = execFileSync('/usr/bin/mdls', [
      '-name', 'kMDItemContentCreationDate',
      '-name', 'kMDItemLatitude',
      '-name', 'kMDItemLongitude',
      file,
    ]).toString();
    const grab = (k) => {
      const m = out.match(new RegExp(`${k}\\s*=\\s*(.+)`));
      if (!m) return null;
      const v = m[1].trim();
      return v === '(null)' ? null : v;
    };
    const rawDate = grab('kMDItemContentCreationDate');
    const lat = grab('kMDItemLatitude');
    const lng = grab('kMDItemLongitude');
    return {
      date_taken: rawDate ? rawDate.slice(0, 10) : null,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    };
  } catch {
    return { date_taken: null, lat: null, lng: null };
  }
}

function toJpegBuffer(file, workDir) {
  if (/\.heic$/i.test(file)) {
    const out = path.join(workDir, `${path.basename(file, path.extname(file))}.jpg`);
    execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', file, '--out', out], { stdio: 'ignore' });
    return readFileSync(out);
  }
  return readFileSync(file);
}

async function findOrCreateVehicle(v) {
  const { data: existing, error: selErr } = await supabase
    .from('vehicles').select('id').eq('name', v.name).maybeSingle();
  if (selErr) throw selErr;
  if (existing) return { id: existing.id, created: false };
  if (DRY) return { id: '(dry-run)', created: true };

  const { data, error } = await supabase
    .from('vehicles')
    .insert({ name: v.name, type: v.type, era: v.era, nation: v.nation })
    .select('id').single();
  if (error) throw error;
  return { id: data.id, created: true };
}

let vehiclesMade = 0, photosMade = 0, skipped = 0, failed = 0;
const workDir = mkdtempSync(path.join(tmpdir(), 'tg-bov-'));

for (const v of VEHICLES) {
  const flag = UNCERTAIN[v.name] ? '  [UNCERTAIN]' : '';
  console.log(`\n=== ${v.name} — ${v.files.length} photo(s) [${v.type}/${v.era}/${v.nation}]${flag} ===`);

  let vehicle;
  try {
    vehicle = await findOrCreateVehicle(v);
    if (vehicle.created) vehiclesMade += 1;
    else console.log(`  vehicle already exists (${vehicle.id}) — attaching photos to it`);
  } catch (e) {
    console.error(`  x vehicle failed: ${e.message}`);
    failed += v.files.length;
    continue;
  }

  const slug = slugify(v.name);

  for (const [i, entry] of v.files.entries()) {
    let src;
    try {
      src = path.join(SRC, resolveSource(entry));
    } catch (e) {
      console.error(`  x ${entry}: ${e.message}`);
      failed += 1;
      continue;
    }

    const stem = storageStem(entry);
    const storagePath = `uploads/${slug}/${stem}.jpg`;
    const thumbPath = `uploads/${slug}/${stem}-thumb.jpg`;

    try {
      const exif = readExif(src);
      const raw = toJpegBuffer(src, workDir);

      const pipeline = sharp(raw).rotate();
      const full = await pipeline
        .clone().resize(FULL_MAX, FULL_MAX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      const thumb = await pipeline
        .clone().resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true }).toBuffer();

      const { data: px, info } = await pipeline
        .clone().raw().ensureAlpha().resize(32, 32, { fit: 'inside' })
        .toBuffer({ resolveWithObject: true });
      const blurhash = encode(new Uint8ClampedArray(px), info.width, info.height, 4, 4);

      const row = {
        vehicle_id: vehicle.id,
        storage_path: storagePath,
        thumbnail_path: thumbPath,
        blurhash,
        width: full.info.width,
        height: full.info.height,
        location_taken: v.location,
        date_taken: exif.date_taken,
        lat: exif.lat,
        lng: exif.lng,
        sort_order: i,
      };

      if (DRY) {
        console.log(`  [dry] ${stem} -> ${storagePath} ${full.info.width}x${full.info.height} ` +
                    `date=${exif.date_taken} gps=${exif.lat?.toFixed(4)},${exif.lng?.toFixed(4)}`);
        photosMade += 1;
        continue;
      }

      const { data: dupe } = await supabase
        .from('photos').select('id').eq('storage_path', storagePath).maybeSingle();
      if (dupe) { console.log(`  - ${stem} already uploaded, skipping`); skipped += 1; continue; }

      for (const [p, buf] of [[storagePath, full.data], [thumbPath, thumb]]) {
        const { error } = await supabase.storage
          .from(BUCKET).upload(p, buf, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      }

      const { error: insErr } = await supabase.from('photos').insert(row);
      if (insErr) throw insErr;

      console.log(`  + ${stem} -> ${storagePath} (${full.info.width}x${full.info.height})`);
      photosMade += 1;
    } catch (e) {
      console.error(`  x ${entry}: ${e.message ?? e}`);
      failed += 1;
    }
  }
}

rmSync(workDir, { recursive: true, force: true });

console.log(`\n${DRY ? 'DRY RUN — nothing written.' : 'Done.'} ` +
            `vehicles: ${vehiclesMade}, photos: ${photosMade}, skipped: ${skipped}, failed: ${failed}`);

console.log(`\n${Object.keys(UNCERTAIN).length} name(s) are inference, not placard-confirmed:`);
for (const [n, why] of Object.entries(UNCERTAIN)) console.log(`  ${n} — ${why}`);
