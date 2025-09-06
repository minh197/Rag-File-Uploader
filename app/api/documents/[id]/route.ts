// app/api/documents/[id]/route.ts
import { NextResponse } from "next/server";
import { store } from "../../../../lib/store";

type Params = { params: { id: string } };

// GET /api/documents/:id
export async function GET(_req: Request, { params }: Params) {
  const doc = store.get(params.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // ✅ hide only the large text; keep processingStatus & chunkCount
  const { extractedContent, ...rest } = doc;
  return NextResponse.json(rest, { status: 200 });
}

// DELETE /api/documents/:id
export async function DELETE(_req: Request, { params }: Params) {
  const doc = store.get(params.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  store.delete(params.id);
  return new Response(null, { status: 204 });
}
