// lib/pinecone.ts
import { Pinecone } from "@pinecone-database/pinecone";

export function getPinecone() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;
  if (!apiKey || !indexName) {
    throw new Error("Missing PINECONE_API_KEY or PINECONE_INDEX_NAME");
  }
  const pc = new Pinecone({ apiKey });
  const index = pc.index(indexName);
  return { pc, index };
}
