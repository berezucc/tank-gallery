# Tank Gallery 2.0

Modern rebuild of [tank-gallery.netlify.app](https://tank-gallery.netlify.app/) — a dark, minimal gallery for personal photos of tanks, aircraft, artillery, and military vehicles, with AI-powered classification on upload.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config)
- **Supabase** — Postgres + Auth + Storage
- **Google Gemini 2.5 Flash** — vehicle classification (Phase 4)
- **Framer Motion** — animations (Phase 2)
- **Vercel** — hosting

## Local setup

```bash
git clone <repo>
cd tank-gallery-v2
npm install
cp .env.example .env.local
# fill in the Supabase + Gemini values, then:
npm run dev
```

Open <http://localhost:3000>.

## Supabase setup

1. Create a project at <https://supabase.com/dashboard>.
2. **Project Settings → API**: copy `Project URL`, `anon` key, and `service_role` key into `.env.local`.
3. **Storage → New bucket**: name it `photos`, set it to **public**.
4. **SQL Editor**: run the migrations in `supabase/migrations/` in order:
   - `001_create_vehicles.sql`
   - `002_create_photos.sql`
   - `003_rls_policies.sql`
   - `004_storage_bucket.sql`
5. **Authentication → Users → Add user**: create your admin account (email/password).

### Optional: run migrations via the CLI

```bash
npm install -g supabase
supabase login   # uses SUPABASE_ACCESS_TOKEN from your env
supabase link --project-ref <your-project-ref>
supabase db push
```

## Gemini setup

1. Get a key at <https://aistudio.google.com/app/apikey>.
2. Paste it into `GEMINI_API_KEY` in `.env.local`.

Free tier covers the one-time bulk classification of the existing collection (~250 requests/day cap; 200–500 photos finishes in 1–2 days).

## Project structure

```
src/
├── app/                  # App Router pages + layouts
│   ├── layout.tsx        # Root layout (dark theme, fonts)
│   ├── page.tsx          # Public gallery (Phase 2)
│   ├── admin/            # Auth-gated admin panel (Phase 3)
│   └── api/              # Route handlers (uploads, classify)
├── components/
│   ├── gallery/          # GalleryGrid, Lightbox, FilterBar, etc.
│   ├── admin/            # UploadZone, ClassifyReview, etc.
│   └── ui/               # Shared primitives
├── lib/
│   ├── supabase/         # Browser, server, service-role clients
│   ├── constants.ts      # Enums + filter options
│   ├── gemini.ts         # Gemini API wrapper (Phase 4)
│   └── images.ts         # Sharp processing (Phase 3)
├── hooks/
└── types/

supabase/
└── migrations/           # SQL applied in numeric order
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server (turbopack) on :3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Build phases

- **Phase 1** ✅ — scaffold (this commit)
- **Phase 2** — public gallery (grid, filters, lightbox)
- **Phase 3** — admin panel (auth, uploads, management)
- **Phase 4** — Gemini classification pipeline
- **Phase 5** — v1 migration + polish

## Security notes

- `NEXT_PUBLIC_*` vars are exposed to the browser. Only the anon key + project URL should be prefixed this way.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — only import from `src/lib/supabase/admin.ts`, only used in server-side code.
- `SUPABASE_ACCESS_TOKEN` (PAT) is for the CLI only — not read at runtime.
