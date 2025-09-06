// app/api/search/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { openai } from "../../../lib/openai";
import { getPinecone } from "../../../lib/pinecone";

type Body = {
  q: string;
  k?: number;
  documentIds?: string[];
  fileTypes?: string[];
};

function makeSnippet(text: string, query: string, radius = 180) {
  if (!text) return "";
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = text.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = hay.indexOf(t);
    if (i >= 0) {
      idx = i;
      break;
    }
  }
  if (idx < 0) {
    // no match found; just truncate
    return text.length > radius * 2 ? text.slice(0, radius * 2) + "…" : text;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + terms[0].length + radius);
  let snip = text.slice(start, end).trim();
  if (start > 0) snip = "…" + snip;
  if (end < text.length) snip = snip + "…";
  return snip;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const q = body?.q?.trim();
    if (!q)
      return NextResponse.json(
        { error: "q (query) is required" },
        { status: 400 }
      );

    const k = body?.k ?? 5;
    const { documentIds, fileTypes } = body;

    // 1) embed the query
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: q,
    });
    const vector = emb.data[0].embedding;

    // 2) optional metadata filters
    let filter: Record<string, any> | undefined;
    if (
      (documentIds && documentIds.length) ||
      (fileTypes && fileTypes.length)
    ) {
      filter = {};
      if (documentIds?.length) filter.documentId = { $in: documentIds };
      if (fileTypes?.length) filter.fileType = { $in: fileTypes };
    }

    // 3) query pinecone
    const { index } = getPinecone();
    const res = await index.query({
      vector,
      topK: k,
      includeMetadata: true,
      filter,
    } as any);

    // 4) normalize results
    const results = (res.matches || []).map((m: any) => ({
      id: m.id as string,
      score: m.score ?? 0,
      documentId: m.metadata?.documentId as string,
      filename: m.metadata?.filename as string,
      fileType: m.metadata?.fileType as string,
      snippet: makeSnippet(m.metadata?.content as string, q),
      chunkIndex: m.metadata?.chunkIndex as number,
      chunkContent: m.metadata?.content as string,
      uploadDate: m.metadata?.uploadDate as string,
    }));

    return NextResponse.json({ q, k, results }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "search error" },
      { status: 500 }
    );
  }
}
