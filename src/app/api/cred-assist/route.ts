import { NextResponse } from "next/server";
import { runCredAssist, type CredAssistInput } from "@/lib/cred-assist";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const secret = process.env.CRED_ASSIST_SECRET;
    if (secret) {
      const header = request.headers.get("authorization") ?? "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (token !== secret) return unauthorized();
    }

    const body = (await request.json()) as CredAssistInput;
    if (!body?.application || !body?.provider || !Array.isArray(body.checklist)) {
      return NextResponse.json(
        { error: "application, provider, and checklist are required" },
        { status: 400 },
      );
    }

    const result = await runCredAssist(body);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
