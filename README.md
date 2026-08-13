# Credentialing

Provider credentialing and compliance management app.

## Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS v4
- Supabase-ready (`src/lib/supabase`, `supabase/migrations`)

## Getting started

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` with keys from [Supabase API settings](https://supabase.com/dashboard/project/jkfzojmltfxwgrkrrgml/settings/api):

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (seed / admin only)

Link and push schema:

```bash
npx supabase login
npm run db:link
npm run db:push
npm run seed:credentialing
npm run dev
```

`npm run seed:credentialing` loads `data/fixtures/Provider_Credentialing_Dataset.xlsx` (42 practitioners) plus 8 synthetic facilities from the POC plan (workbook has no Facilities sheet yet).

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/dashboard`.

**Supabase project:** `jkfzojmltfxwgrkrrgml` → https://jkfzojmltfxwgrkrrgml.supabase.co

## Project structure

```
src/
  app/
    (auth)/          # login + auth callback
    (app)/           # authenticated app shell routes
    api/             # REST stubs for core domains
  components/        # shared layout + UI
  features/          # domain modules (providers, credentials, …)
  lib/               # utils, auth, supabase clients
  types/             # shared TypeScript domain types
supabase/migrations/ # database schema
docs/                # architecture notes
```

## Main routes

| Route | Purpose |
| --- | --- |
| `/dashboard` | Status overview |
| `/providers` | Provider list / detail |
| `/credentials` | Licenses & certifications |
| `/applications` | Credentialing applications |
| `/organizations` | Facilities / groups |
| `/expirations` | Renewal monitoring |
| `/documents` | Uploaded files |
| `/settings` | Workspace settings |
| `/login` | Auth entry |
