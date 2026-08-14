import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  createPortalApplication,
  type PortalIntakeInput,
} from "@/lib/portal/applications";
import { syncPortalApplication } from "@/lib/salesforce/sync";
import { syncPendingDocumentsForApplication } from "@/lib/portal/documents";
import { runPsvForApplication } from "@/lib/psv/orchestrator";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PortalIntakeInput;
    if (!body?.subjectType || !body?.applicationType || !body?.path) {
      return NextResponse.json(
        { error: "subjectType, applicationType, and path are required" },
        { status: 400 },
      );
    }
    if (!body.providerId && !body.provider?.displayName?.trim()) {
      return NextResponse.json(
        { error: "Provider display name is required for new records" },
        { status: 400 },
      );
    }

    const result = await createPortalApplication(body);
    const { salesforceSyncPayload, ...data } = result;

    after(async () => {
      try {
        const sync = await syncPortalApplication(salesforceSyncPayload);
        if (!sync.ok) {
          console.error("[portal→salesforce]", sync.message);
        } else if (!sync.skipped) {
          console.log("[portal→salesforce]", sync.message);
        }
        const docs = await syncPendingDocumentsForApplication(
          data.applicationId,
        );
        console.log("[portal→salesforce files]", docs);
      } catch (e) {
        console.error("[portal→salesforce]", e);
      }

      try {
        const psv = await runPsvForApplication(data.applicationId);
        console.log(
          "[portal→psv]",
          data.applicationId,
          psv.readiness.overallStatus,
          `${psv.readiness.score}%`,
        );
        const { syncPsvResultsToSalesforce } = await import(
          "@/lib/salesforce/psvSync"
        );
        const sfPsv = await syncPsvResultsToSalesforce(data.applicationId);
        if (!sfPsv.ok) {
          console.error("[portal→psv→salesforce]", sfPsv.message);
        } else {
          console.log("[portal→psv→salesforce]", sfPsv.message);
        }
      } catch (e) {
        console.error("[portal→psv]", e);
      }
    });

    return NextResponse.json({
      data: {
        ...data,
        salesforceSyncQueued: true,
        psvQueued: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
