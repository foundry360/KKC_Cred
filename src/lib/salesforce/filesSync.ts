import {
  getSalesforceCliAuth,
  isSalesforceCliSyncEnabled,
} from "@/lib/salesforce/cliAuth";
import { sfExtId } from "@/lib/salesforce/portalIntake";

export type SfFileUploadResult = {
  ok: boolean;
  skipped?: boolean;
  contentDocumentId?: string;
  contentVersionId?: string;
  message?: string;
};

async function sfQuery(
  soql: string,
): Promise<{ Id: string } | null> {
  const auth = getSalesforceCliAuth();
  if (!auth) return null;
  const url = `${auth.instanceUrl}/services/data/v${auth.apiVersion}/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { records?: Array<{ Id: string }> };
  return json.records?.[0] ?? null;
}

export async function findSalesforceApplicationId(
  applicationExternalId: string,
): Promise<string | null> {
  const ext = sfExtId(applicationExternalId).replace(/'/g, "\\'");
  const row = await sfQuery(
    `SELECT Id FROM Credentialing_Application__c WHERE External_Id__c = '${ext}' LIMIT 1`,
  );
  return row?.Id ?? null;
}

export async function findSalesforceProviderId(
  providerExternalId: string,
): Promise<string | null> {
  const ext = sfExtId(providerExternalId).replace(/'/g, "\\'");
  const row = await sfQuery(
    `SELECT Id FROM Provider__c WHERE External_Id__c = '${ext}' LIMIT 1`,
  );
  return row?.Id ?? null;
}

/**
 * Upload a file into Salesforce Files and publish it onto a record
 * (FirstPublishLocationId creates the ContentDocumentLink).
 */
export async function uploadFileToSalesforce(input: {
  title: string;
  fileName: string;
  contentType: string;
  data: Buffer;
  linkedRecordId: string;
}): Promise<SfFileUploadResult> {
  if (!isSalesforceCliSyncEnabled()) {
    return { ok: true, skipped: true, message: "SF CLI sync disabled" };
  }

  const auth = getSalesforceCliAuth();
  if (!auth) {
    return {
      ok: false,
      message: "Salesforce CLI auth unavailable — run sf org login / check SF_TARGET_ORG",
    };
  }

  const boundary = `----credBoundary${Date.now()}`;
  const meta = JSON.stringify({
    Title: input.title.slice(0, 200),
    PathOnClient: input.fileName,
    FirstPublishLocationId: input.linkedRecordId,
  });

  const metaPart = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="entity_content"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${meta}\r\n`,
    "utf8",
  );
  const fileHeader = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="VersionData"; filename="${input.fileName.replace(/"/g, "")}"\r\n` +
      `Content-Type: ${input.contentType || "application/octet-stream"}\r\n\r\n`,
    "utf8",
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const body = Buffer.concat([metaPart, fileHeader, input.data, footer]);

  const url = `${auth.instanceUrl}/services/data/v${auth.apiVersion}/sobjects/ContentVersion`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      message: `ContentVersion upload failed (${res.status}): ${text.slice(0, 400)}`,
    };
  }

  let versionId: string | undefined;
  try {
    versionId = (JSON.parse(text) as { id?: string }).id;
  } catch {
    /* ignore */
  }

  let contentDocumentId: string | undefined;
  if (versionId) {
    const q = await fetch(
      `${auth.instanceUrl}/services/data/v${auth.apiVersion}/query?q=${encodeURIComponent(
        `SELECT ContentDocumentId FROM ContentVersion WHERE Id = '${versionId}' LIMIT 1`,
      )}`,
      { headers: { Authorization: `Bearer ${auth.accessToken}` } },
    );
    if (q.ok) {
      const json = (await q.json()) as {
        records?: Array<{ ContentDocumentId?: string }>;
      };
      contentDocumentId = json.records?.[0]?.ContentDocumentId;
    }
  }

  return {
    ok: true,
    contentVersionId: versionId,
    contentDocumentId,
    message: "Uploaded to Salesforce Files",
  };
}
