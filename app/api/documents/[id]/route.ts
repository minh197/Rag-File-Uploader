import { NextResponse } from "next/server";
import { store } from "../../../../lib/store";

type Params = { params: Promise<{ id: string }> };

// GET /api/documents/:id
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const doc = store.get(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(doc, { status: 200 });
}

// DELETE /api/documents/:id
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const doc = store.get(id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  store.delete(id);
  // 204 No Content indicates successful deletion with no response body
  return new Response(null, { status: 204 });
}
