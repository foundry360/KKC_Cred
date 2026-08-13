# Credentialing Proof of Concept
## Development Start Plan

**Document type:** Implementation plan (PDF-ready)  
**Product:** Credentialing / Recredentialing POC  
**Stack:** Next.js · Supabase (Postgres)  
**Data source:** `Provider_Credentialing_Dataset.xlsx` (extended with synthetic facilities)  
**Date:** 12 August 2026

---

## 1. Purpose

Prove a vertical slice of credentialing workflow automation:

1. Intake classification (practitioner vs facility)
2. Completeness checklist gate
3. Status orchestration
4. Recredentialing / expiration queue

Seed the system from **one** synthetic workbook. Practitioners already exist in the file; **facilities are added to the same spreadsheet** (not a separate JSON/CSV fixture).

Live integrations (Aperture, Visual Cactus, CAQH APIs), committee voting UIs, and Salesforce metadata are out of scope for this POC.

---

## 2. Locked decisions

| Decision | Choice |
| --- | --- |
| Seed format | Single Excel workbook only |
| Facility data | New sheets inside the same workbook |
| Subject model | One `providers` table with `subject_type` = practitioner \| facility |
| Expiration window | 90 days (“EXPIRING SOON”), matching workbook logic |
| Recred cycle | NCQA-style 3 years via cred effective → expiration dates |
| Auth (POC) | Stubbed; status changes via API |
| Workflow overlays | Applications, checklists, outreach derived after import (not Excel columns) |

---

## 3. Workstream checklist

| # | Workstream | Deliverable |
| --- | --- | --- |
| 0 | Extend workbook | Facilities + facility child sheets (~8 facilities) |
| 1 | Vendor dataset | Copy workbook to `data/fixtures/Provider_Credentialing_Dataset.xlsx` |
| 2 | Schema | Supabase migration for orgs, providers, credentials, sanctions, POC overlays |
| 3 | Import | `scripts/import-credentialing-xlsx.ts` + `npm run seed:credentialing` |
| 4 | Types | Align `src/types` with imported fields |
| 5 | App wiring | Supabase clients, env, API routes, list/detail UI |
| 6 | POC behaviors | Intake, checklist gate, outreach, recred/expirations |
| 7 | Docs | Update `docs/architecture.md` with ER and success criteria |

---

## 4. Phase 0 — Extend the workbook

### 4.1 Keep existing sheets

| Sheet | Role |
| --- | --- |
| README | Update for facilities, join keys, flag logic |
| Providers (42 rows) | Practitioners (unchanged) |
| Licenses | Practitioner state licenses |
| Board_Certifications | Practitioner board certs |
| DEA_Registrations | Practitioner DEA (subset) |
| Malpractice_Insurance | Practitioner malpractice |
| Sanctions_Exclusions_Monitoring | Practitioner monitoring |

### 4.2 Add facility sheets

| New sheet | Approx. rows | Purpose |
| --- | --- | --- |
| Facilities | ~8 | Master facility subjects (parallel to Providers) |
| Facility_Licenses | ~8 | State facility / operating licenses |
| Facility_Accreditations | ~8 | AAAHC / Joint Commission / CARF / etc. |
| Facility_Malpractice | ~8 | Entity liability / malpractice |
| Facility_Sanctions_Monitoring | ~8 | Exclusion / sanctions-style checks |
| Facility_CLIA (optional) | ~2–3 | Lab facilities only |

### 4.3 Facilities sheet columns

Align to Providers where possible:

- Facility ID (e.g. FAC-2001) — join key for child sheets
- Facility Name
- Facility Type — ASC | Imaging | Clinic | SNF | Urgent Care | Lab | PT
- NPI (Type 2 where applicable)
- Group/TIN Entity + TIN — prefer existing five groups; allow one independent org if needed
- Practice State
- Credentialing Status — Active | Pending Recredentialing | Provisional | Under Committee Review
- Cred. Effective Date / Cred. Expiration Date — 3-year cycle
- Days to Recred. Expiration / Recred. Status Flag — same formulas as Providers (EXPIRED / EXPIRING SOON ≤90 days / ACTIVE)

### 4.4 Suggested synthetic facilities

| Facility ID | Name | Type | Group |
| --- | --- | --- | --- |
| FAC-2001 | Coastal Ambulatory Surgery Center | ASC | Coastal Medical Group |
| FAC-2002 | Harborview Imaging Center | Imaging | Harborview Multispecialty Group |
| FAC-2003 | Sunrise Behavioral Health Clinic | Clinic | Sunrise Health Partners |
| FAC-2004 | Meridian Skilled Nursing | SNF | Meridian Physician Network |
| FAC-2005 | Vanguard Urgent Care — Midtown | Urgent Care | Vanguard Clinical Associates |
| FAC-2006–2008 | Lab / PT / independent ASC | Mixed | Existing or new TIN |

Include mixed credentialing statuses and at least one expired and one expiring-soon license or accreditation. Use real Excel dates so formulas recalculate like the practitioner sheets. Update README to state all facility data is synthetic.

---

## 5. Data flow (workbook → database)

1. Read `Provider_Credentialing_Dataset.xlsx` from `data/fixtures/`.
2. Upsert **organizations** from distinct Group/TIN on Providers and Facilities.
3. Upsert **providers** (`PRV-*` practitioners, `FAC-*` facilities).
4. Upsert **credentials** from practitioner and facility child sheets.
5. Upsert **sanctions_checks** from both monitoring sheets.
6. Derive **applications**, **checklist_items**, and **outreach_attempts** for demo scenarios.
7. Application UI and APIs read from Supabase; recompute expiry flags from stored dates (do not trust stale Excel flag columns as source of truth after import).

### 5.1 Credential kinds

**Practitioner:** medical_license, board_certification, dea, malpractice_insurance  

**Facility:** facility_license, accreditation, malpractice_insurance, clia (optional)

---

## 6. Phase 1 — Schema and import

### 6.1 Core tables

| Table | Purpose |
| --- | --- |
| organizations | Groups from Group/TIN on both master sheets |
| providers | Practitioners and facilities (`subject_type`) |
| credentials | All credential child sheets |
| sanctions_checks | Both monitoring sheets |

### 6.2 POC overlay tables

| Table | Purpose |
| --- | --- |
| applications | new \| recred; path caqh \| in_house \| facility \| delegated |
| checklist_templates / checklist_items | Separate practitioner vs facility templates |
| outreach_attempts | Three-attempt chase |
| documents | Optional metadata stub |

### 6.3 Application status machine

draft → incomplete → in_review → pending_committee → approved | denied | termed | withdrawn

### 6.4 Import script

- Path: `scripts/import-credentialing-xlsx.ts`
- Command: `npm run seed:credentialing`
- Responsibilities: parse workbook, convert Excel dates to ISO, upsert core tables, seed thin POC overlays

---

## 7. Phase 2 — Wire Supabase into the app

1. Install `@supabase/supabase-js` and `@supabase/ssr`.
2. Implement `src/lib/supabase/client.ts` and `server.ts`.
3. Configure `.env.local` from `.env.example`.
4. Replace API stubs under `src/app/api/` with real queries.
5. Render list/detail pages under `src/app/(app)/` with Practitioner / Facility filter; detail shows credentials and sanctions.

---

## 8. Phase 3 — Four POC behaviors

| # | Behavior | Proof |
| --- | --- | --- |
| 1 | Intake | Choose practitioner vs facility; instantiate matching checklist; block leave-draft if incomplete |
| 2 | Status machine | Advance to in_review only when checklist complete |
| 3 | Outreach | Record attempts on incomplete apps (include ≥1 facility) |
| 4 | Recred / expirations | Queue expired and ≤90-day cases for both subject types; action to create recred application |

Also update `docs/architecture.md` with workbook provenance, entity relationships, and success criteria.

---

## 9. Out of scope

- Live Aperture, Visual Cactus, or CAQH API integrations
- Cat A / Cat B committee voting UI
- Bulk delegated NetSub loads (thousands of rows)
- Certified mail processing
- Salesforce metadata / org packaging
- Separate facilities JSON or CSV fixture

---

## 10. Success criteria

1. Workbook contains Facilities and facility child sheets with approximately eight synthetic facilities.
2. Import loads 42 practitioners, ~8 facilities, organizations from both, and all credential/sanctions rows from the **single** xlsx.
3. UI lists and filters practitioners and facilities.
4. An incomplete facility application cannot move to `in_review`.
5. Expirations view shows expired and expiring-soon cases for both subject types.
6. Happy path works for one practitioner and one facility: complete checklist → in_review → approved.

---

## 11. Architecture (logical)

**Client:** Next.js App Router UI  

**Server:** API routes / server actions  

**Database:** Supabase Postgres  

**Seed:** `scripts/import-credentialing-xlsx.ts` ← `data/fixtures/Provider_Credentialing_Dataset.xlsx`

Flow: Workbook → Import script → Supabase ← API ← UI

---

## 12. Related documents

| Document | Location |
| --- | --- |
| Docs index | `docs/README.md` |
| TriWest friction map | `docs/triwest-friction-map.pdf` |
| Cred POC — where to start | `docs/cred-poc-start.pdf` |
| This App / Supabase plan | `docs/poc-development-plan.pdf` |
| Salesforce POC configuration | `docs/sfdc-configuration-plan.pdf` |
| Architecture notes | `docs/architecture.md` |

---

## Document control

| Field | Value |
| --- | --- |
| Title | Credentialing POC — Development Start Plan |
| Audience | Product, engineering, credentialing SME |
| Classification | Internal — synthetic data only |
