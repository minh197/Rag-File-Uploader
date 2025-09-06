export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { store } from "../../../lib/store";

export async function GET() {
  const documents = await store.list();
  return NextResponse.json({ documents }, { status: 200 });
}
