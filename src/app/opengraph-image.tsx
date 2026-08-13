import { ImageResponse } from 'next/og';
import { STORAGE_BUCKET } from '@/lib/constants';

export const alt = 'Archive — military hardware, in person';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0a0a0a';

// Pulled straight from the REST API rather than the server client: this runs
// outside a request context, so there are no cookies to read.
async function loadPreview(): Promise<{ urls: string[]; total: number }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return { urls: [], total: 0 };

  try {
    const res = await fetch(
      `${base}/rest/v1/photos?select=storage_path,thumbnail_path&order=created_at.desc&limit=4`,
      { headers: { apikey: key, Prefer: 'count=exact' }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return { urls: [], total: 0 };

    const rows = (await res.json()) as { storage_path: string; thumbnail_path: string | null }[];
    const total = Number(res.headers.get('content-range')?.split('/')[1] ?? 0);

    return {
      urls: rows.map((r) => `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${r.thumbnail_path ?? r.storage_path}`),
      total,
    };
  } catch {
    return { urls: [], total: 0 };
  }
}

export default async function OpengraphImage() {
  const { urls, total } = await loadPreview();

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: BG }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '72px',
            width: urls.length ? '54%' : '100%',
          }}
        >
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.03em' }}>
            Archive
          </div>
          <div style={{ display: 'flex', marginTop: 18, fontSize: 30, color: '#a1a1aa' }}>
            Military hardware, in person.
          </div>
          <div style={{ display: 'flex', marginTop: 40, fontSize: 22, color: '#52525b' }}>
            {total ? `${total} photographs` : 'Tanks · Ships · Submarines · Artillery'}
          </div>
        </div>

        {urls.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', width: '46%', height: '100%' }}>
            {urls.slice(0, 4).map((u) => (
              <img
                key={u}
                src={u}
                alt=""
                width={size.width * 0.23}
                height={size.height / 2}
                style={{ objectFit: 'cover' }}
              />
            ))}
          </div>
        )}
      </div>
    ),
    size,
  );
}
