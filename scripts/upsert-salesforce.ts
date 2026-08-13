/**
 * Bulk upsert exported CSVs into Salesforce (cred-poc org).
 * Requires: sf CLI authenticated as cred-poc
 */
import { spawnSync } from "node:child_process";
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
] as const;

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
