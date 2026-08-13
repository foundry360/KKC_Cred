# Salesforce POC Configuration Plan
## Supabase Ingest · Flows · Standard Physician 360 · HITL

**Document type:** Salesforce POC plan (PDF-ready) — **not production**  
**UI approach:** **Standard Lightning record pages + related lists** (no custom LWCs)  
**Upstream data:** Supabase Credentialing POC dataset  
**Date:** 12 August 2026

---

## 1. POC framing

Prove Salesforce can:

1. Hold provider/facility credential data loaded from Supabase  
2. Run a small set of Flows (intake, checklist gate, chase, recred)  
3. Give Cred Specs a **Physician 360** using **out-of-the-box Lightning pages**  
4. Pause for humans (Spec work → TL escalation; optional committee Approval)

This is a **demo POC**. Do not introduce middleware platforms, Experience Cloud, OmniStudio, Health Cloud packaging, custom LWCs, or bi-directional enterprise sync.

---

## 2. UI approach (locked)

| Decision | Choice |
| --- | --- |
| Physician 360 | **Standard Lightning Record Page** on `Provider__c` |
| Facility view | Same record page; filter by `Subject_Type__c = Facility` |
| Page building | Lightning App Builder only |
| Components allowed | Highlight Panel, Record Detail, Path, Related Lists, Activities, standard Quick Actions / Screen Flow actions |
| Custom LWCs | **Out of scope for POC** |
| Custom Aura | **Out of scope for POC** |
| Dynamic Forms | Optional; not required |

**Physician 360 = configured record page, not a custom UI build.**

---

## 3. Simple architecture

```
Supabase (POC data)
        │
        │  one-way load
        │  (Data Loader CSV  — preferred —
        │   or one simple scheduled HTTP pull)
        ▼
Salesforce custom objects
        │
        ├── Screen Flow: Intake
        ├── Record-Triggered Flow: Checklist gate
        ├── Flow + scheduled paths: Outreach chase
        ├── Scheduled Flow: Recred due soon
        └── Standard Lightning Record Page: Physician 360
```

Supabase supplies demo master data. Salesforce owns Application status, Tasks, and Approvals for the demo.

---

## 4. POC use cases (narrow)

| ID | Show | Implementation |
| --- | --- | --- |
| UC-01 | Practitioner vs Facility intake | Screen Flow |
| UC-02 | Checklist blocks In Review | Checklist related list + record-triggered Flow |
| UC-04 | 3-attempt outreach → TL | Flow scheduled paths + standard Tasks |
| UC-06 | Recred candidates | Nightly Flow creates Recred Application |
| UC-07 | Committee approve (optional) | One standard Approval Process |
| UC-12 | Physician 360 | **Standard record page + related lists** |

**Defer:** WMC gate, Cat B / Med Director workspace, QA sampler, delegated bulk loads, DocGen products, Experience Cloud, Aperture/VC/CAQH, custom LWCs.

---

## 5. Data ingest (POC-simple)

### Preferred

1. Export CSV from Supabase (organizations, providers, credentials, optional sanctions).  
2. **Data Loader** upsert using External Id.  
3. Re-run when demo data changes.

### Optional

Named Credential + one Scheduled Flow or small Apex job to upsert Providers and Credentials.

**Skip:** MuleSoft, Platform Events mesh, mapping metadata framework, sync-error console, webhooks.

| Supabase | Salesforce |
| --- | --- |
| organizations | Account (or Organization__c) |
| providers | Provider__c |
| credentials | Provider_Credential__c |
| sanctions_checks | Sanctions_Check__c (optional) |
| applications | Credentialing_Application__c |

---

## 6. Salesforce components

### 6.1 Custom objects (four)

| Object | Purpose |
| --- | --- |
| Provider__c | Practitioner or facility (`Subject_Type__c`, `External_Id__c`, NPI, names, org, cred dates, status) |
| Provider_Credential__c | License, DEA, board, malpractice, facility license, accreditation |
| Credentialing_Application__c | New \| Recred; Path; Status; Provider lookup |
| Checklist_Item__c | Required items; Complete checkbox |

Outreach and escalations use **standard Tasks** (no Outreach custom object).

### 6.2 Application fields (minimum)

- Application_Type__c — New | Recred  
- Path__c — CAQH | In_House | Facility  
- Status__c — Draft | Incomplete | In_Review | Pending_Committee | Approved | Denied  
- Subject_Type__c — Practitioner | Facility  
- Attempt_Count__c  
- External_Id__c  

### 6.3 Queues (two)

| Queue | Role |
| --- | --- |
| Cred_Spec_Queue | Specs |
| Cred_TL_Queue | Team Lead escalations |

Optional Public Group: `Cred_Committee` for Approvals.

### 6.4 Permission sets

- Cred_Spec  
- Cred_TL  
- Cred_Committee (optional)  

---

## 7. Physician 360 — standard record page recipe

### 7.1 App

Lightning App: **Credentialing POC**  
Navigation: Providers, Applications, Tasks (standard items only).

### 7.2 Record page on Provider__c (App Builder)

Assemble **only** standard components:

| Region | Standard component | Shows |
| --- | --- | --- |
| Header | Highlight Panel | NPI, specialty / facility type, group, cred status, recred date |
| Main | Record Detail | Core provider / facility fields |
| Main | Related List — Credentials | Provider_Credential__c |
| Main | Related List — Applications | Credentialing_Application__c |
| Main | Related List — Checklist Items | Via Application, or related if master-detail allows |
| Sidebar | Activities / Open Activities | Tasks (chase, escalate) |
| Optional | Related List — Sanctions | If object loaded |

### 7.3 Application record page (standard)

| Component | Purpose |
| --- | --- |
| Path | Status guidance (Draft → … → Approved) |
| Record Detail | Application fields |
| Related List — Checklist Items | Completeness |
| Related List — Open Activities | Chase / HITL Tasks |
| Highlights | Path, type, subject |

### 7.4 Standard actions (no LWC)

| Action | Type |
| --- | --- |
| New Application | Screen Flow quick action on Provider |
| Log Outreach | Action that creates a Task (Flow or standard New Task) |
| Escalate to TL | Screen or auto-launched Flow → reassign Cred_TL_Queue |

### 7.5 List views (standard)

- Providers — Practitioners  
- Providers — Facilities  
- Applications — Incomplete (chase)  
- Applications — Recred due / Pending Committee  

**Explicitly not in POC:** custom LWC expiry badges, checklist progress rings, custom timeline components, FlexiPage Aura.

---

## 8. Flows (four)

| Flow | Type | Behavior |
| --- | --- | --- |
| Cred_Intake | Screen | Subject type, New/Recred, Path; create Application + checklist rows |
| Cred_Checklist_Gate | Record-triggered | Incomplete checklist → Status Incomplete; block In_Review |
| Cred_Outreach_Chase | Record-triggered + scheduled paths | Tasks on day 0 / 1 / 3; after attempt 3 → Cred_TL_Queue |
| Cred_Recred_Nightly | Scheduled | Expiry ≤ 120 days + no open Recred app → create Recred Application |

**Optional:** one Approval Process when Status = Pending_Committee.

---

## 9. Human-in-the-loop

| Step | Who | Mechanism |
| --- | --- | --- |
| Fix docs / call provider | Cred Spec | Checklist + Tasks on standard pages |
| Stuck / final chase | Cred TL | Queue reassignment |
| Committee (optional) | Approvers | Standard Approval Process |
| Certified mail | Cred Spec | Manual Task only — never auto-send |

Escalation path for POC: **Spec → TL** only.

---

## 10. Build order

1. Create four custom objects, fields, two queues.  
2. Data Loader load from Supabase CSVs.  
3. Configure **standard** Provider + Application Lightning record pages (Physician 360).  
4. Build Intake + Checklist Gate Flows.  
5. Build Outreach Chase + Recred Nightly Flows.  
6. Optional: one Approval Process.  

**Done when:** Spec opens a synced provider on the standard 360 page, sees related credentials/apps, starts intake, is blocked by checklist, gets chase Tasks, and an expiring provider gets a Recred Application — **without any custom LWC**.

---

## 11. Out of scope

- Custom LWCs / Aura for 360 or checklist UI  
- Production cutover from Visual Cactus / Apttus  
- MuleSoft, event mesh, bi-directional sync frameworks  
- Health Cloud / OmniStudio / Experience Cloud as requirements  
- Cat B Med Director packet app, QA sampler, WMC service, delegated bulk loads  
- Real CAQH / Aperture / VC adapters  
- Automatic certified mail  

---

## 12. Related documents

| Document | Location |
| --- | --- |
| Docs index | `docs/README.md` |
| TriWest friction map | `docs/triwest-friction-map.pdf` |
| Cred POC — where to start | `docs/cred-poc-start.pdf` |
| App / Supabase POC plan | `docs/poc-development-plan.pdf` |
| This SFDC POC plan | `docs/sfdc-configuration-plan.pdf` |
| Architecture notes | `docs/architecture.md` |

---

## Document control

| Field | Value |
| --- | --- |
| Title | Salesforce POC Configuration Plan |
| UI standard | Lightning Record Pages + Related Lists (no custom LWC) |
| Nature | Demo / proof of concept only |
