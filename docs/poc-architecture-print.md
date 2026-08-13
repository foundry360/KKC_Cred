# Credentialing POC — Architecture Diagram
## Lean build: workbook → Supabase / Next.js → Salesforce demo

**Document type:** Architecture (PDF-ready)  
**Nature:** Proof of concept — not production  
**Date:** 12 August 2026

---

## 1. One-page picture

```
┌─────────────────────────────────────────────────────────────────┐
│  Provider_Credentialing_Dataset.xlsx                            │
│  (Providers + Facilities sheets — synthetic)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ import / seed
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase (Postgres)          POC data store                    │
│  orgs · providers · credentials · sanctions · apps/checklist    │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                │ API                         │ CSV / Data Loader
                │                             │ (one-way)
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│  Next.js Credentialing    │   │  Salesforce POC                 │
│  App (App Router)         │   │                                 │
│  · Dashboard / lists      │   │  Provider__c  (+ Facility via    │
│  · Provider / Facility UI │   │   Subject_Type__c)              │
│  · Applications           │   │  Provider_Credential__c         │
│  · Expirations / recred   │   │  Credentialing_Application__c   │
│  · Checklist gate (app)   │   │  Checklist_Item__c              │
└───────────────────────────┘   │                                 │
                                │  Standard Lightning pages       │
                                │  (Physician 360 — no LWCs)      │
                                │                                 │
                                │  Flows: Intake · Checklist ·    │
                                │  Chase · Recred Nightly         │
                                │  Queues: Spec · TL              │
                                │  Optional: 1 Approval           │
                                └─────────────────────────────────┘
```

**Principle:** Workbook is seed truth → Supabase holds POC data → Next.js proves app UX → Salesforce proves TriWest workflow spine (intake, checklist, chase, recred, HITL) on standard pages.

---

## 2. Context diagram

```
                 ┌──────────────┐
                 │ Cred Spec /  │
                 │ Cred TL      │
                 └──────┬───────┘
                        │ uses
            ┌───────────┴───────────┐
            ▼                       ▼
     ┌─────────────┐         ┌─────────────┐
     │ Next.js App │         │ Salesforce  │
     └──────┬──────┘         └──────┬──────┘
            │ reads                 │ load / Flows
            ▼                       │
     ┌─────────────┐                │
     │  Supabase   │◄───────────────┘
     └──────┬──────┘
            │ seeded from
            ▼
     ┌─────────────┐
     │ Excel xlsx  │
     └─────────────┘

Out of POC box (not connected): Aperture · Visual Cactus · Apttus · CAQH API · AP · MoveIT
```

---

## 3. Data model (shared logical shape)

```
organizations 1───* providers (practitioner | facility)
                      │
                      ├──* credentials  (license, DEA, board, malpractice,
                      │                  facility_license, accreditation, …)
                      ├──* sanctions_checks   (optional)
                      └──* applications (new | recred)
                               │
                               └──* checklist_items
```

Salesforce maps 1:1 for the POC (`Provider__c`, `Provider_Credential__c`, `Credentialing_Application__c`, `Checklist_Item__c`). Outreach uses **standard Tasks**.

---

## 4. Runtime flows (what the POC proves)

### 4.1 Data path

```
xlsx ──seed──► Supabase ──CSV/Data Loader──► Salesforce objects
                  │
                  └──REST/API──► Next.js pages
```

### 4.2 Salesforce workflow path

```
Intake Screen Flow
        │
        ▼
Application + Checklist rows
        │
        ├── incomplete ──► Status = Incomplete
        │                      │
        │                      ▼
        │              Chase Tasks (day 0 / 1 / 3)
        │                      │
        │                      └── attempt 3 ──► Cred_TL_Queue
        │
        └── checklist complete ──► In_Review ──► (optional Approval)
                                         │
                                         ▼
                                      Approved

Recred Nightly (parallel): expiry ≤ 120 days + no open Recred app
        │
        └── create Recred Application
```

### 4.3 Human-in-the-loop

```
Spec (Cred_Spec_Queue) ──fix──► TL (Cred_TL_Queue)
  checklist / calls / tasks           escalated chase
  Physician 360 (standard page)       stuck files
  cert mail = manual Task only
```

---

## 5. Component inventory (POC only)

| Layer | Components |
| --- | --- |
| Seed | `Provider_Credentialing_Dataset.xlsx` (Providers + Facilities sheets) |
| Data | Supabase Postgres tables; import script |
| App | Next.js App Router, list/detail, expirations |
| SF data | 4 custom objects; Account/org as needed |
| SF UI | Lightning App; **standard** Provider + Application record pages |
| SF automation | 4 Flows (+ optional Approval); 2 queues |
| SF HITL | Spec → TL; cert mail Task |

---

## 6. Explicit non-goals (keep the diagram honest)

Not on this architecture for the POC:

- MuleSoft / event mesh / bi-directional sync  
- Custom LWCs for Physician 360  
- Experience Cloud committee portal  
- Live Aperture / VC / CAQH / AP adapters  
- Cat B Med Director packet workspace  
- QA 10% sampler, WMC gate, delegated 2–3K load  

---

## 7. Related documents

| Document | File |
| --- | --- |
| Docs index | `docs/README.md` |
| TriWest friction map | `docs/triwest-friction-map.pdf` |
| Cred POC Start | `docs/cred-poc-start.pdf` |
| App / Supabase plan | `docs/poc-development-plan.pdf` |
| Salesforce POC config | `docs/sfdc-configuration-plan.pdf` |

---

## Document control

| Field | Value |
| --- | --- |
| Title | Credentialing POC — Architecture Diagram |
| Nature | Lean POC architecture |
| UI standard | Lightning Record Pages + Related Lists (no custom LWC) |
