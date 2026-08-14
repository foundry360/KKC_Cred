import { createServiceClient } from "@/lib/supabase/admin";
import { sfExtId } from "@/lib/salesforce/portalIntake";
import {
  findSalesforceApplicationId,
  findSalesforceProviderId,
  uploadFileToSalesforce,
} from "@/lib/salesforce/filesSync";

const BUCKET = "portal-documents";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB POC limit

export type PortalDocumentRow = {
  id: string;
  external_id: string;
  file_name: string | null;
  content_type: string | null;
  storage_path: string | null;
  checklist_item_key: string | null;
  salesforce_content_document_id: string | null;
  salesforce_synced_at: string | null;
  created_at: string;
};

type DocMeta = {
  checklistItemKey?: string | null;
  contentDocumentId?: string | null;
  syncedAt?: string | null;
};

function stamp() {
  return Date.now().toString(36).toUpperCase();
}

function metaPath(storagePath: string) {
  return `${storagePath}.meta.json`;
}

async function readMeta(storagePath: string | null): Promise<DocMeta> {
  if (!storagePath) return {};
  const sb = createServiceClient();
  const { data, error } = await sb.storage.from(BUCKET).download(metaPath(storagePath));
  if (error || !data) return {};
  try {
    return JSON.parse(await data.text()) as DocMeta;
  } catch {
    return {};
  }
}

async function writeMeta(storagePath: string, meta: DocMeta) {
  const sb = createServiceClient();
  const body = Buffer.from(JSON.stringify(meta, null, 2), "utf8");
  await sb.storage.from(BUCKET).upload(metaPath(storagePath), body, {
    contentType: "application/json",
    upsert: true,
  });
}

function parseChecklistKeyFromExternalId(externalId: string): string | null {
  // ...-DOC-{itemKey}-{stamp}
  const m = externalId.match(/-DOC-(.+)-[A-Z0-9]+$/i);
  if (!m) return null;
  return m[1] || null;
}

async function ensureBucket() {
  const sb = createServiceClient();
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
  });
  if (error && !/already exists|duplicate|exists/i.test(error.message)) {
    throw new Error(error.message);
  }
}

async function hydrateRow(row: {
  id: string;
  external_id: string;
  file_name: string | null;
  content_type: string | null;
  storage_path: string | null;
  created_at: string;
}): Promise<PortalDocumentRow> {
  const meta = await readMeta(row.storage_path);
  return {
    ...row,
    checklist_item_key:
      meta.checklistItemKey ||
      parseChecklistKeyFromExternalId(row.external_id),
    salesforce_content_document_id: meta.contentDocumentId || null,
    salesforce_synced_at: meta.syncedAt || null,
  };
}

export async function listDocumentsForApplication(applicationId: string) {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("documents")
    .select("id, external_id, file_name, content_type, storage_path, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map((row) => hydrateRow(row)));
}

function documentTypeFromChecklistKey(key?: string | null): string | null {
  if (!key) return null;
  const k = key.toLowerCase();
  if (k.includes("license")) return "medical_license";
  if (k.includes("dea")) return "dea_certificate";
  if (k.includes("board")) return "board_certification";
  if (k.includes("malpractice") || k.includes("coi")) return "malpractice_coi";
  if (k.includes("cv") || k.includes("resume")) return "cv";
  return key;
}

export async function savePortalDocument(input: {
  applicationId: string;
  providerId: string;
  applicationExternalId: string;
  providerExternalId: string;
  checklistItemKey?: string | null;
  fileName: string;
  contentType: string;
  data: Buffer;
  syncToSalesforce?: boolean;
}) {
  if (!input.data.length) throw new Error("Empty file");
  if (input.data.length > MAX_BYTES) {
    throw new Error("File exceeds 10 MB limit");
  }

  await ensureBucket();
  const sb = createServiceClient();

  const itemKey = (input.checklistItemKey || "file").replace(/[^\w-]+/g, "_");
  const externalId = sfExtId(
    `${input.applicationExternalId}-DOC-${itemKey}-${stamp()}`,
  );
  const safeName = input.fileName.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180);
  const storagePath = `${input.providerExternalId}/${input.applicationExternalId}/${externalId}-${safeName}`;

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, input.data, {
      contentType: input.contentType || "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw new Error(upErr.message);

  await writeMeta(storagePath, {
    checklistItemKey: input.checklistItemKey || null,
  });

  const { data: row, error: insErr } = await sb
    .from("documents")
    .insert({
      external_id: externalId,
      provider_id: input.providerId,
      application_id: input.applicationId,
      file_name: safeName,
      content_type: input.contentType || null,
      storage_path: storagePath,
      document_type: documentTypeFromChecklistKey(input.checklistItemKey),
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
    })
    .select("id, external_id, file_name, content_type, storage_path, created_at")
    .single();
  if (insErr) throw new Error(insErr.message);

  const document = await hydrateRow(row);

  let sfMessage: string | null = null;
  if (input.syncToSalesforce === true) {
    const synced = await syncDocumentRowToSalesforce(document, {
      applicationExternalId: input.applicationExternalId,
      providerExternalId: input.providerExternalId,
    });
    sfMessage = synced.message || null;
    if (synced.ok && synced.contentDocumentId) {
      return {
        document: {
          ...document,
          salesforce_content_document_id: synced.contentDocumentId,
          salesforce_synced_at: new Date().toISOString(),
        },
        salesforceSynced: true,
        salesforceMessage: sfMessage,
      };
    }
  }

  return {
    document,
    salesforceSynced: false,
    salesforceMessage: sfMessage,
  };
}

export async function syncDocumentRowToSalesforce(
  doc: PortalDocumentRow,
  ids: { applicationExternalId: string; providerExternalId: string },
): Promise<{ ok: boolean; contentDocumentId?: string; message?: string }> {
  if (doc.salesforce_content_document_id) {
    return {
      ok: true,
      contentDocumentId: doc.salesforce_content_document_id,
      message: "Already synced",
    };
  }
  if (!doc.storage_path || !doc.file_name) {
    return { ok: false, message: "Document missing storage path" };
  }

  const sb = createServiceClient();
  const { data: fileData, error: dlErr } = await sb.storage
    .from(BUCKET)
    .download(doc.storage_path);
  if (dlErr || !fileData) {
    return { ok: false, message: dlErr?.message || "Download failed" };
  }
  const buffer = Buffer.from(await fileData.arrayBuffer());

  const linkedId =
    (await findSalesforceApplicationId(ids.applicationExternalId)) ||
    (await findSalesforceProviderId(ids.providerExternalId));

  if (!linkedId) {
    return {
      ok: false,
      message:
        "Salesforce application/provider not found yet — record sync may still be running",
    };
  }

  const title = doc.checklist_item_key
    ? `${doc.checklist_item_key} — ${doc.file_name}`
    : doc.file_name;

  const uploaded = await uploadFileToSalesforce({
    title,
    fileName: doc.file_name,
    contentType: doc.content_type || "application/octet-stream",
    data: buffer,
    linkedRecordId: linkedId,
  });

  if (!uploaded.ok || uploaded.skipped) {
    return { ok: uploaded.ok, message: uploaded.message };
  }

  if (uploaded.contentDocumentId) {
    await writeMeta(doc.storage_path, {
      checklistItemKey: doc.checklist_item_key,
      contentDocumentId: uploaded.contentDocumentId,
      syncedAt: new Date().toISOString(),
    });
  }

  return {
    ok: true,
    contentDocumentId: uploaded.contentDocumentId,
    message: uploaded.message,
  };
}

export async function syncPendingDocumentsForApplication(applicationId: string) {
  const sb = createServiceClient();
  const { data: app, error } = await sb
    .from("applications")
    .select("id, external_id, provider_id, providers(external_id)")
    .eq("id", applicationId)
    .single();
  if (error) throw new Error(error.message);

  const providerRaw = app.providers as
    | { external_id?: string }
    | { external_id?: string }[]
    | null;
  const provider = Array.isArray(providerRaw) ? providerRaw[0] : providerRaw;
  const providerExternalId = provider?.external_id;
  if (!providerExternalId) {
    return { synced: 0, failed: 0, message: "Missing provider external id" };
  }

  const docs = await listDocumentsForApplication(applicationId);
  let synced = 0;
  let failed = 0;
  for (const doc of docs) {
    if (doc.salesforce_content_document_id) {
      synced += 1;
      continue;
    }
    const result = await syncDocumentRowToSalesforce(doc, {
      applicationExternalId: app.external_id,
      providerExternalId,
    });
    if (result.ok && result.contentDocumentId) synced += 1;
    else failed += 1;
  }
  return { synced, failed };
}
