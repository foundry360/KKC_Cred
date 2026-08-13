# Architecture

Credentialing is a Next.js App Router application for managing healthcare provider credentialing workflows, with a lean Salesforce POC for TriWest-aligned intake, checklist, chase, and recred demos.

## Layers

- `src/app` — routes and API handlers (thin)
- `src/features` — domain logic, hooks, and feature-specific UI composition
- `src/components` — shared layout and reusable UI
- `src/lib` — clients, auth, and utilities
- `src/types` — shared domain types
- `supabase/migrations` — database schema

## Core domains

- **Providers** — practitioners and facilities being credentialed
- **Credentials** — licenses, certifications, DEA, insurance, facility accreditation
- **Applications** — credentialing packets moving through review
- **Organizations** — hospitals, clinics, and groups
- **Documents** — uploaded supporting files
- **Expirations** — monitoring and renewal workflows

## Planning docs

See [README.md](README.md) for the full document pack. Architecture diagram: [poc-architecture.pdf](poc-architecture.pdf) · [poc-architecture.md](poc-architecture.md).
