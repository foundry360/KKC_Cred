import { NextResponse } from "next/server";
import {
  getProvider,
  listCredentialsForProvider,
  listSanctionsForProvider,
} from "@/lib/providers";

type Params = Promise<{ id: string }>;

export async function GET(
  _request: Request,
  context: { params: Params },
) {
  try {
    const { id } = await context.params;
    const provider = await getProvider(id);
    if (!provider) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const [credentials, sanctions] = await Promise.all([
      listCredentialsForProvider(id),
      listSanctionsForProvider(id),
    ]);
    return NextResponse.json({ data: { provider, credentials, sanctions } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
