import {
  syncPortalApplicationViaCli,
  type PortalSfSyncInput,
  type PortalSfSyncResult,
} from "@/lib/salesforce/cliSync";
import { syncPortalApplicationViaHttp } from "@/lib/salesforce/httpSync";
import { hasSalesforceOauth } from "@/lib/salesforce/client";

/**
 * Sync portal application to Salesforce via REST upserts.
 * Auth: OAuth env (Vercel) or local `sf` CLI token fallback.
 * CLI bulk upsert is used only as a secondary local path.
 */
export async function syncPortalApplication(
  input: PortalSfSyncInput,
): Promise<PortalSfSyncResult> {
  const http = await syncPortalApplicationViaHttp(input);
  if (http.ok) return http;

  // Local fallback: CLI bulk (may be flaky under spawn; REST preferred)
  const cli = syncPortalApplicationViaCli(input);
  if (cli.ok) return cli;

  return {
    ok: false,
    message: [
      http.message,
      cli.message,
      hasSalesforceOauth()
        ? null
        : "Tip: on Vercel, set SF_CLIENT_ID, SF_CLIENT_SECRET, SF_LOGIN_URL, SF_AUTH_FLOW=client_credentials (with a Run As user).",
    ]
      .filter(Boolean)
      .join(" | "),
  };
}
