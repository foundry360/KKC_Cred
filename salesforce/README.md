# Salesforce Credentialing POC

Deployable metadata for the Salesforce side of the POC (step 1 of `docs/sfdc-configuration-plan-print.md`).

## What this package contains

| Component | API name |
| --- | --- |
| Custom objects | `Provider__c`, `Provider_Credential__c`, `Credentialing_Application__c`, `Checklist_Item__c` |
| Queues | `Cred_Spec_Queue`, `Cred_TL_Queue` |
| Permission sets | `Cred_Spec`, `Cred_TL` |
| Lightning app | **Credentialing POC** |
| Tabs | Providers, Applications, Credentials, Checklist Items |

Upsert key on every object: **`External_Id__c`** (unique external id — `PRV-*` / `FAC-*` from Supabase).

## Prerequisites

- Salesforce CLI (`sf`) — installed globally if you followed the setup in this repo
- A Salesforce **Developer Edition** (or sandbox) you can log into

## 1. Authenticate your Dev org

From this directory:

```bash
cd salesforce
sf org login web --alias cred-poc --set-default
```

A browser window opens. Log in to your Dev org and Allow access.

Confirm:

```bash
sf org display --target-org cred-poc
```

## 2. Deploy metadata

```bash
sf project deploy start --source-dir force-app --target-org cred-poc --wait 10
```

## 3. Assign a permission set to yourself

```bash
sf org assign permset --name Cred_Spec --target-org cred-poc
# optional Team Lead access:
sf org assign permset --name Cred_TL --target-org cred-poc
```

## 4. Open the app

```bash
sf org open --path /lightning/app/c__Credentialing_POC --target-org cred-poc
```

Or in the org: App Launcher → **Credentialing POC**.


## Flows (deployed & active)

| Flow | Type | Behavior |
| --- | --- | --- |
| `Cred_Intake` | Screen | New/Recred + Path → Application + checklist (from Provider **New Application** button) |
| `Cred_Checklist_Gate` | Before-save | Blocks In Review if required checklist incomplete → forces **Incomplete** |
| `Cred_Outreach_Chase` | After-save + schedule | Incomplete → Spec Task (day 0); day 1 & day 3 chase; attempt 3 → **Cred TL Queue** |
| `Cred_Recred_Nightly` | Daily schedule | Recred Due ≤ 120 days + no open Recred → create Draft Recred Application |


## Approval Process (deployed & active)

| Component | Detail |
| --- | --- |
| **Committee Approval** | Entry: `In_Review` or `Pending_Committee` |
| Approvers | You (user) or **Cred TL Queue** — first response wins |
| On submit | Status → `Pending_Committee` |
| On approve | Status → `Approved` |
| On reject | Status → `Denied` |
| Group / permset | `Cred_Committee` |

**UI path:** Complete checklist → Path to **In Review** → **Submit for Approval** → Approve from Items to Approve / Approval History.

## Sync from Supabase

From repo root (after `npm run seed:credentialing`):

```bash
npm run sync:salesforce
```

Writes CSVs under `data/exports/salesforce/` and Bulk-API upserts on `External_Id__c` (Providers → Credentials → Applications → Checklist).

## Next (after deploy)

1. Manually create a sample Provider + Application in the UI to smoke-test  
2. Load Supabase CSVs via Data Loader upsert on `External_Id__c`  
3. Configure standard Lightning record pages (Physician 360)  
4. Build the four Flows (Intake → Checklist Gate → Outreach → Recred)

## Out of scope here

Flows, Lightning page layouts, Approval Processes, Named Credentials — those come after objects/queues are live.
