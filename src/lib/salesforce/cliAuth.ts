import { spawnSync } from "node:child_process";

export type SalesforceCliAuth = {
  accessToken: string;
  instanceUrl: string;
  apiVersion: string;
};

function targetOrg(): string {
  return process.env.SF_TARGET_ORG || "cred-poc";
}

/**
 * Reuse the local authenticated Salesforce CLI session (no Connected App).
 */
export function getSalesforceCliAuth(): SalesforceCliAuth | null {
  const org = targetOrg();
  const env = {
    ...process.env,
    SF_TEMP_SHOW_SECRETS: "true",
  };
  const res = spawnSync(
    "sf",
    ["org", "display", "--target-org", org, "--json"],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024, env },
  );
  if (res.status !== 0) return null;
  try {
    const parsed = JSON.parse(res.stdout || "{}") as {
      result?: {
        accessToken?: string;
        instanceUrl?: string;
      };
    };
    const accessToken = parsed.result?.accessToken;
    const instanceUrl = parsed.result?.instanceUrl;
    if (!accessToken || !instanceUrl) return null;
    return {
      accessToken,
      instanceUrl: instanceUrl.replace(/\/$/, ""),
      apiVersion: process.env.SF_API_VERSION || "61.0",
    };
  } catch {
    return null;
  }
}

export function isSalesforceCliSyncEnabled(): boolean {
  const flag = (process.env.SF_SYNC_VIA_CLI || "true").toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return true;
}
