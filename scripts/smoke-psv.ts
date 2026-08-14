import { config } from "dotenv";
config({ path: ".env.local" });
import { runPsvForApplication } from "../src/lib/psv/orchestrator";

async function run(label: string, id: string) {
  console.log("\n===", label, "===");
  const result = await runPsvForApplication(id);
  console.log(
    "readiness:",
    result.readiness.score + "%",
    result.readiness.overallStatus,
  );
  console.log("identityPass:", result.reconciliation.identityPass);
  console.log("PSV:");
  for (const r of result.psvResults) {
    console.log(
      " -",
      r.sourceMode.toUpperCase(),
      r.sourceName,
      "=>",
      r.status,
      "|",
      r.resultSummary.slice(0, 110),
    );
  }
  console.log("exceptions:", result.reconciliation.findings.length);
  for (const f of result.reconciliation.findings.slice(0, 6)) {
    console.log(
      " -",
      f.severity,
      f.type + ":",
      f.description.slice(0, 130),
    );
  }
}

async function main() {
  await run("MATCH", "0f35a41a-0df0-477b-910c-4b0d5c65590a");
  await run("MISMATCH", "3b453236-0758-421f-ac2f-7bec6d55ca68");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
