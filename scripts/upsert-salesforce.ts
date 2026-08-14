/**
 * Bulk upsert exported CSVs into Salesforce (cred-poc org).
 * Requires: sf CLI authenticated as cred-poc
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ORG = "cred-poc";
const DIR = resolve(process.cwd(), "data/exports/salesforce");

const JOBS = [
  {
    file: "01_Provider__c.csv",
    sobject: "Provider__c",
    externalId: "External_Id__c",
  },
  {
    file: "02_Provider_Credential__c.csv",
    sobject: "Provider_Credential__c",
    externalId: "External_Id__c",
  },
  {
    file: "03_Credentialing_Application__c.csv",
    sobject: "Credentialing_Application__c",
    externalId: "External_Id__c",
  },
  {
    file: "04_Checklist_Item__c.csv",
    sobject: "Checklist_Item__c",
    externalId: "External_Id__c",
  },
  {
    file: "05_Education_History__c.csv",
    sobject: "Education_History__c",
    externalId: "External_Id__c",
  },
  {
    file: "06_Work_History__c.csv",
    sobject: "Work_History__c",
    externalId: "External_Id__c",
  },
  {
    file: "07_Provider_Address__c.csv",
    sobject: "Provider_Address__c",
    externalId: "External_Id__c",
  },
] as const;

function csvHasDataRows(file: string): boolean {
  if (!existsSync(file)) return false;
  const lines = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  return lines.length > 1;
}

function run(args: string[]) {
  console.log("\n$", "sf", args.join(" "));
  const res = spawnSync("sf", args, { encoding: "utf8", stdio: "inherit" });
  if (res.status !== 0) {
    throw new Error(`sf failed with exit ${res.status}`);
  }
}

function main() {
  for (const job of JOBS) {
    const file = resolve(DIR, job.file);
    if (!csvHasDataRows(file)) {
      console.log(`\nSkipping ${job.file} (no data rows).`);
      continue;
    }
    run([
      "data",
      "upsert",
      "bulk",
      "--sobject",
      job.sobject,
      "--file",
      file,
      "--external-id",
      job.externalId,
      "--target-org",
      ORG,
      "--wait",
      "10",
      "--line-ending",
      "LF",
    ]);
  }
  console.log("\nSalesforce upsert complete.");
}

main();
