// Copy every photo object from Supabase Storage to R2, keeping a local backup.
//
// For each object: download from Supabase → write to BACKUP_DIR (same key) →
// upload to R2 → confirm R2's size matches. Nothing is deleted here; removing
// the Supabase copies is a separate step once the site is verified on R2.
//
// Objects whose eTag matches a *referenced* object are skipped: they are
// byte-identical leftovers of the 2026-05-25 bulk upload that no photo row
// points at. Unreferenced objects with no twin are still copied.
//
// Run with:
//   node --env-file=.env.local scripts/migrate-storage-to-r2.mjs --dry-run
//   node --env-file=.env.local scripts/migrate-storage-to-r2.mjs
//
// Safe to re-run: objects already backed up and present in R2 at the right
// size are skipped.

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { photoSize, putPhoto } from './lib/r2.mjs';

const DRY = process.argv.includes('--dry-run');
const BUCKET = 'photos';
const BACKUP_DIR = '/Users/nikita/Documents/tank-gallery-storage-backup';
const CONCURRENCY = 6;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pat = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(url).hostname.split('.')[0];

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const objects = await sql(`
  with refs as (
    select storage_path p from public.photos
    union select thumbnail_path from public.photos where thumbnail_path is not null
  ),
  ref_etags as (
    select metadata->>'eTag' e from storage.objects
    where bucket_id = '${BUCKET}' and name in (select p from refs)
  )
  select name,
         (metadata->>'size')::bigint as size,
         metadata->>'mimetype' as mimetype,
         name in (select p from refs) as referenced,
         metadata->>'eTag' in (select e from ref_etags) as has_twin
  from storage.objects
  where bucket_id = '${BUCKET}'
  order by name`);

const todo = objects.filter((o) => o.referenced || !o.has_twin);
const skippedDupes = objects.length - todo.length;
const totalMB = todo.reduce((s, o) => s + Number(o.size), 0) / 1e6;
console.log(
  `${objects.length} objects in Supabase; copying ${todo.length} (${totalMB.toFixed(0)} MB), ` +
  `skipping ${skippedDupes} byte-identical duplicates.`,
);
if (DRY) process.exit(0);

mkdirSync(BACKUP_DIR, { recursive: true });
writeFileSync(path.join(BACKUP_DIR, 'manifest.json'), JSON.stringify(objects, null, 2));

let copied = 0, already = 0, failed = 0;

async function migrate(o) {
  const size = Number(o.size);
  const local = path.join(BACKUP_DIR, o.name);
  const haveLocal = (() => { try { return statSync(local).size === size; } catch { return false; } })();

  if (haveLocal && (await photoSize(o.name)) === size) {
    already += 1;
    return;
  }

  let buf;
  if (haveLocal) {
    buf = readFileSync(local);
  } else {
    const res = await fetch(`${url}/storage/v1/object/authenticated/${BUCKET}/${o.name}`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    if (!res.ok) throw new Error(`download ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    if (buf.length !== size) throw new Error(`downloaded ${buf.length} bytes, expected ${size}`);
    mkdirSync(path.dirname(local), { recursive: true });
    writeFileSync(local, buf);
  }

  await putPhoto(o.name, buf, o.mimetype || 'application/octet-stream');
  const remote = await photoSize(o.name);
  if (remote !== size) throw new Error(`R2 has ${remote} bytes, expected ${size}`);
  copied += 1;
}

const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let o = queue.shift(); o; o = queue.shift()) {
    try {
      await migrate(o);
    } catch (e) {
      failed += 1;
      console.error(`  ✗ ${o.name}: ${e.message ?? e}`);
    }
    const done = copied + already + failed;
    if (done % 100 === 0) console.log(`  … ${done}/${todo.length}`);
  }
}));

console.log(`\n✓ copied ${copied}, already done ${already}, failed ${failed}`);
console.log(`Backup: ${BACKUP_DIR}`);
if (failed) process.exit(1);
