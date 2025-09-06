// app/api/documents/[id]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { store } from "../../../../lib/store";

type Params = { params: { id: string } };

// GET /api/documents/:id
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const { id } = await ctx.params;

  const doc = await store.get(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { extractedContent, ...rest } = doc; // hide large text payload
  return NextResponse.json(rest, { status: 200 });
}

// DELETE /api/documents/:id
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const { id } = await ctx.params;

  const doc = await store.get(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await store.delete(id); // ← store is async now
  return new Response(null, { status: 204 });
}
