# Credentialing POC — Architecture

Lean proof-of-concept architecture. Print/PDF twin: [poc-architecture-print.md](poc-architecture-print.md) · [poc-architecture.pdf](poc-architecture.pdf).

## System context

```mermaid
flowchart TB
  users[Cred_Spec_and_TL]
  xlsx[Provider_Credentialing_Dataset_xlsx]
  sb[(Supabase_Postgres)]
  next[Nextjs_App]
  sf[Salesforce_POC]

  xlsx -->|seed_import| sb
  sb -->|API| next
  sb -->|CSV_Data_Loader| sf
  users --> next
  users --> sf
```

## Logical data model

```mermaid
erDiagram
  organizations ||--o{ providers : has
  providers ||--o{ credentials : holds
  providers ||--o{ applications : subject_of
  applications ||--o{ checklist_items : requires
  providers ||--o{ sanctions_checks : monitored
```

## Salesforce workflow spine

```mermaid
flowchart LR
  intake[Intake_Screen_Flow]
  app[Application_plus_Checklist]
  gate{Checklist_complete}
  chase[Chase_Tasks_0_1_3]
  tl[Cred_TL_Queue]
  review[In_Review]
  appr[Optional_Approval]
  done[Approved]
  recred[Recred_Nightly]

  intake --> app --> gate
  gate -->|no| chase --> tl
  gate -->|yes| review --> appr --> done
  recred --> app
```

## Layers

| Layer | Responsibility |
| --- | --- |
| Excel workbook | Synthetic practitioners + facilities |
| Supabase | POC system of record for demo data |
| Next.js | App UX: lists, detail, expirations |
| Salesforce | Intake, checklist gate, chase, recred, Physician 360 (standard pages) |

See [README.md](README.md) for the full document pack.
