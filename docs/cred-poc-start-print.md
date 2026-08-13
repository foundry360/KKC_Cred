# Credentialing POC — Where to Start
## Thin Application lifecycle before integrations

**Document type:** POC start guide (PDF-ready)  
**Product:** Credentialing / recredentialing proof of concept  
**Date:** 12 August 2026  
**Pairs with:** TriWest friction map · App/Supabase plan · Salesforce POC configuration plan

---

## 1. Start here

Build a **thin Application lifecycle** first — not Aperture, Visual Cactus, or a committee portal.

Prove one vertical slice:

**Provider → Credentialing Application (New / Recred) → Credentials → Checklist**

Then four automations (in order):

1. **Intake Screen Flow** — Practitioner vs Facility, New vs Recred, Path; completeness gate  
2. **Checklist / status gate** — cannot reach In Review while incomplete (Path on Application)  
3. **3-attempt outreach** — scheduled paths → Spec Tasks → escalate to TL  
4. **Recred-at-~120 days** — nightly job creates Recred Applications  

**UI:** Physician 360 = **standard Lightning record page + related lists** (no custom LWCs).  
**Data:** Load synthetic practitioners/facilities from the workbook via Supabase (or CSV) into SF for demo.

Pitch: *Salesforce becomes the intake + status + recred clock; Cactus/Aperture stay verification engines until the workflow layer is proven.*

---

## 2. Why this slice

| Reason | Detail |
| --- | --- |
| Highest pain, low dependency | TriWest map’s worst friction is intake typing and incomplete apps — solvable without VC/Aperture |
| Recred is a clear before/after | Mgrs already pull recred months out; a scheduled create-Recred job demos value fast |
| Demoable to Cred Specs | Specs live in chase loops and status updates; outreach + 360 shows daily-work relief |

---

## 3. Minimum data model

| Object | Must-have |
| --- | --- |
| Provider__c (or equivalent) | NPI, Practitioner \| Facility, org, cred dates/status, External Id |
| Credentialing_Application__c | New \| Recred; Path (CAQH / In_House / Facility); Status; due dates |
| Provider_Credential__c | Type, number, issuer, issued/expires, status |
| Checklist_Item__c | Template-driven required docs/data; complete? blocks advance |

**Conventions:**

- Application.Type = New | Recred  
- Application.Path = CAQH | In_House | Facility (Delegated later)  
- Status picklist advanced by Flow / Path — not free-form spreadsheet churn  

---

## 4. Four Flows (build order)

| # | Flow | Proves | Why first |
| --- | --- | --- | --- |
| 1 | Intake Screen Flow | Classify subject; New vs Recred; checklist before queue | Fixes #1 TriWest pain |
| 2 | Checklist / status gate | Draft → Incomplete → In Review → … → Approved/Denied | Replaces VC checkbox churn for the demo |
| 3 | Outreach cadence | Attempt 1/2/3; escalate to TL | Highest demo wow per build hour |
| 4 | Recred scheduler | Auto-create Recred apps ~120 days before expiry | No Aperture/VC needed to prove the pattern |

Optional stretch: one standard **Approval Process** (Cat A–style).

---

## 5. In POC scope vs out

### Do

- Manual create / Data Loader (or Supabase CSV) for Providers and Credentials  
- Checklist templates: Practitioner vs Facility (new vs recred)  
- List views: Incomplete chase, recred due, Pending Committee  
- Spec + TL queues; cert mail as a **manual Task** only  
- Standard Lightning Physician 360 (Highlight, Detail, Related Lists, Activities)

### Defer / substitute

| Defer | POC substitute |
| --- | --- |
| Aperture file exchange | Path label only / ignore |
| Visual Cactus as SoR | SF + Supabase hold demo data |
| Cat B / Med Director workspace | Out of POC |
| 2–3K delegated bulk load | Out of POC |
| Certified mail send | Human Task — never auto-send |
| CAQH live API | Fields preloaded from dataset |

---

## 6. Success criteria

| Scenario | Pass condition |
| --- | --- |
| Happy path | New Practitioner app: complete checklist → In Review → Approved |
| Incomplete gate | Facility (or practitioner) app with open checklist items cannot reach In Review |
| Chase | Incomplete app creates Spec Tasks on cadence; attempt 3 → TL |
| Recred | Expiring credential/provider auto-spawns Recred Application |
| 360 | Spec opens Provider record page and sees credentials, apps, tasks — no custom LWC |

---

## 7. After the POC lands

| Next | Only after core path is trusted |
| --- | --- |
| Approvals | Cat A daily batch; later Cat B |
| Integrations | Aperture / CAQH / VC / AP one at a time |
| Experience Cloud | Committee portal (email size-limit pain) |

---

## 8. Related documents

| Document | File |
| --- | --- |
| TriWest friction map | `docs/triwest-friction-map.pdf` |
| App / Supabase development plan | `docs/poc-development-plan.pdf` |
| Salesforce POC configuration | `docs/sfdc-configuration-plan.pdf` |
| Docs index | `docs/README.md` |

---

## Document control

| Field | Value |
| --- | --- |
| Title | Credentialing POC — Where to Start |
| Nature | POC scoping / start guide |
| UI standard | Lightning Record Pages + Related Lists (no custom LWC) |
