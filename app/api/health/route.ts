import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "document-rag-system",
    time: new Date().toISOString(),
  });
}
