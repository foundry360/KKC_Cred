# TriWest Credentialing — Friction Map
## Automation opportunities vs current-state flow

**Document type:** Analysis (PDF-ready)  
**Source:** TriWest Credentialing current-state process map (TW Credentialing PDF, 2026-08-12)  
**Purpose:** Identify friction that Salesforce (or similar) workflow can remove; feed POC scope  
**Date:** 12 August 2026

---

## 1. Summary

The TriWest current-state map is heavy with spreadsheet, email, folder, and Visual Cactus status handoffs. Highest leverage for a **POC** (not full production build):

1. Classify intake early (Practitioner vs Facility)  
2. Enforce a completeness checklist  
3. Orchestrate the 3-attempt chase with human Spec work  
4. Drive a recred clock from expiration dates  

Adjacent systems named in the flow: Visual Cactus (VC), Apttus, Aperture, CAQH, AP, MoveIT, email/folders, WMC spreadsheet.

---

## 2. Friction → automation map

| Area | Friction in current flow | Typical SF engine (full vision) | Impact | Effort | In lean POC? |
| --- | --- | --- | --- | --- | --- |
| Intake routing | No systematic Facility vs Practitioner (or CAQH vs non-CAQH); incomplete apps cannot be routed | Screen Flow + checklist / decisioning | Critical | High | **Yes** |
| Delegated / NetSub load | Manual spreadsheet entry of delegated providers (up to 2–3K) | Data import + record-triggered Flow | Critical | Medium | No — defer |
| Email / Apttus intake | Incoming email opened manually; attachments ad hoc | Email-to-Case / Flow + Files | High | Medium | No — defer |
| CAQH / screen data entry | Provider data and VC screens entered by hand; partial Aperture uploads | Integration + field mapping | Critical | High | No — mock via dataset |
| Aperture handoffs | TL builds queries/spreadsheets for daily/weekly Aperture jobs | Scheduled Flow + outbound jobs | High | High | No — defer |
| Completeness chase | 3 attempts / 3 days to Provider/DCM; then cancel / term / PEND | Scheduled-path Flow + Tasks | High | Low | **Yes** |
| Status / system sync | Manual VC status flips; VC→AP export waits | Record-triggered Flow + integration | High | Medium | Partial — Path on Application |
| Cat A committee | Daily list + email voting; minutes in folders | Approval Process | High | Medium | Optional stretch |
| Cat B + Med Director | Packets via MoveIT; Med Director assigns; email size limits | Portal + Flow (later) | High | High | No — defer |
| QA / 10% audit | Spreadsheet sample; hard to aggregate | Scheduled sample + Cases | Medium | Medium | No — defer |
| Delegated annual audit | Random URAC sample outside SF | Scheduled sample rules | High | Medium | No — defer |
| Letter generation | Templates / large PDF extract / save to VC | DocGen (later); cert mail human | High | Medium | Manual Task only |
| Recred triggers | Mgr pulls recred ~4 months out | Scheduled Flow | High | Low | **Yes** (~120 days) |
| WMC eligibility gate | Manual external spreadsheet check | Lookup object + Flow | Medium | Low | No — defer |
| PDF conversion | Docs must be PDF before VC upload | Middleware (later) | Medium | Medium | No — defer |
| Multi-source updates | Updates spawn untracked Spec tasks | Tasks from a single queue | Medium | Medium | Partial — standard Tasks |

---

## 3. Keep largely human (per flow notes)

| Step | Guidance |
| --- | --- |
| Certified mail send | Term/denial cert mail remains manual |
| Med Director clinical judgment | Queueing can help; decision stays human |
| Committee clinical vote | Automate packet delivery/capture later; voting stays human |
| P&P alignment (pre-audit) | Policy judgment before NetSub/Delegated load |

---

## 4. Engine fit (reference — full vision)

**Scheduled / path Flows:** Recred clock, Cat A daily list, Aperture jobs, 3-attempt outreach, delegated annual sample, monthly Cat B cycle.

**Record-triggered Flows:** Ready for QA → Auditor; Pending Committee → packet; Approved → letter + recred date; Non-response → PEND path.

**Approvals + Experience Cloud (later):** Replace Cat A email voting and Cat B MoveIT packets.

**Intake checklist + decisioning:** Explicit pain — incomplete apps; cannot route Practitioner vs Facility vs Delegated.

---

## 5. Suggested waves (full program vs POC)

| Wave | Focus | POC? |
| --- | --- | --- |
| Wave 1 — Foundation | Intake type + checklist; thin status model | **Yes — this is the POC** |
| Wave 2 — Orchestration | Chase cadence, recred, letters stub, optional Cat A Approval | **Yes — chase + recred; Cat A optional** |
| Wave 3 — Ecosystem | Aperture/CAQH/VC/AP, delegated load, committee portal | **No — post-POC** |

---

## 6. Related documents

| Document | File |
| --- | --- |
| Cred POC Start | `docs/cred-poc-start.pdf` |
| App / Supabase development plan | `docs/poc-development-plan.pdf` |
| Salesforce POC configuration | `docs/sfdc-configuration-plan.pdf` |
| Docs index | `docs/README.md` |

---

## Document control

| Field | Value |
| --- | --- |
| Title | TriWest Credentialing — Friction Map |
| Nature | Analysis for POC scoping |
| Classification | Internal |
