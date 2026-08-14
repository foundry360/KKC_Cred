import { after } from "next/server";
import { NextResponse } from "next/server";
import { savePortalDocument } from "@/lib/portal/documents";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const applicationId = String(form.get("applicationId") || "");
    const providerId = String(form.get("providerId") || "");
    const applicationExternalId = String(form.get("applicationExternalId") || "");
    const providerExternalId = String(form.get("providerExternalId") || "");
    const checklistItemKey = String(form.get("checklistItemKey") || "") || null;
    const syncFlag = String(form.get("syncToSalesforce") || "true");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!applicationId || !providerId || !applicationExternalId || !providerExternalId) {
      return NextResponse.json(
        {
          error:
            "applicationId, providerId, applicationExternalId, and providerExternalId are required",
        },
        { status: 400 },
      );
    }

    const contentType = file.type || "application/octet-stream";
    if (contentType && !ALLOWED_TYPES.has(contentType) && contentType !== "application/octet-stream") {
      // allow octet-stream if extension looks ok
      const lower = file.name.toLowerCase();
      const okExt = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"].some((e) =>
        lower.endsWith(e),
      );
      if (!okExt) {
        return NextResponse.json(
          { error: "Unsupported file type. Use PDF, image, or Word." },
          { status: 400 },
        );
      }
    }

    const data = Buffer.from(await file.arrayBuffer());
    const result = await savePortalDocument({
      applicationId,
      providerId,
      applicationExternalId,
      providerExternalId,
      checklistItemKey,
      fileName: file.name,
      contentType,
      data,
      // Prefer background SF sync after record upsert; store in Supabase now
      syncToSalesforce: syncFlag === "immediate",
    });

    if (syncFlag !== "immediate") {
      after(async () => {
        try {
          const { syncDocumentRowToSalesforce } = await import(
            "@/lib/portal/documents"
          );
          // Retry a few times while SF record sync catches up
          for (let i = 0; i < 6; i++) {
            const synced = await syncDocumentRowToSalesforce(result.document, {
              applicationExternalId,
              providerExternalId,
            });
            if (synced.ok && synced.contentDocumentId) {
              console.log("[portal→salesforce files]", synced.message);
              return;
            }
            await new Promise((r) => setTimeout(r, 5000));
          }
          console.error(
            "[portal→salesforce files] still pending for",
            result.document.id,
          );
        } catch (e) {
          console.error("[portal→salesforce files]", e);
        }
      });
    }

    return NextResponse.json({
      data: {
        ...result.document,
        salesforceSyncQueued: syncFlag !== "immediate",
        salesforceSynced: result.salesforceSynced,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
