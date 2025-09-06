// lib/store.ts
import { kv, createClient } from "@vercel/kv";

export type ProcessingStatus =
  | "uploading"
  | "extracting"
  | "embedding"
  | "completed"
  | "error";

export type DocumentRecord = {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadDate: string; // ISO string
  extractedContent?: string;
  processingStatus: ProcessingStatus;
  chunkCount?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
};

// If default KV_* envs are present use `kv`; else fall back to Upstash envs
const client =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? kv
    : createClient({
        url: process.env.UPSTASH_REDIS_REST_URL!, // optional fallback
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

const SET_KEY = "docs:set";
const DOC_KEY = (id: string) => `doc:${id}`;

export const store = {
  async list(): Promise<DocumentRecord[]> {
    const ids = (await client.smembers<string[]>(SET_KEY)) || [];
    if (!ids.length) return [];
    const pipe = client.pipeline();
    ids.forEach((id) => pipe.hgetall(DOC_KEY(id)));
    const rows = (await pipe.exec()) as any[];
    return rows
      .map((r) => r || null)
      .filter(Boolean)
      .map((r) => ({
        id: r.id,
        filename: r.filename,
        fileType: r.fileType,
        fileSize: Number(r.fileSize),
        uploadDate: r.uploadDate,
        extractedContent: r.extractedContent || undefined,
        processingStatus: r.processingStatus as ProcessingStatus,
        chunkCount: r.chunkCount ? Number(r.chunkCount) : undefined,
        errorMessage: r.errorMessage || undefined,
        metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      }));
  },

  async get(id: string): Promise<DocumentRecord | undefined> {
    const r = await client.hgetall(DOC_KEY(id));
    if (!r) return undefined;
    return {
      id: r.id as string,
      filename: r.filename as string,
      fileType: r.fileType as string,
      fileSize: Number(r.fileSize),
      uploadDate: r.uploadDate as string,
      extractedContent: (r.extractedContent as string) || undefined,
      processingStatus: r.processingStatus as ProcessingStatus,
      chunkCount: r.chunkCount ? Number(r.chunkCount) : undefined,
      errorMessage: (r.errorMessage as string) || undefined,
      metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    };
  },

  async add(doc: DocumentRecord) {
    await client.hset(DOC_KEY(doc.id), {
      ...doc,
      fileSize: String(doc.fileSize),
      chunkCount: doc.chunkCount != null ? String(doc.chunkCount) : undefined,
      metadata: doc.metadata ? JSON.stringify(doc.metadata) : undefined,
    });
    await client.sadd(SET_KEY, doc.id);
  },

  async update(id: string, patch: Partial<DocumentRecord>) {
    const curr = await this.get(id);
    if (!curr) return;
    const next: DocumentRecord = { ...curr, ...patch };
    await client.hset(DOC_KEY(id), {
      ...next,
      fileSize: String(next.fileSize),
      chunkCount: next.chunkCount != null ? String(next.chunkCount) : undefined,
      metadata: next.metadata ? JSON.stringify(next.metadata) : undefined,
    });
  },

  async delete(id: string) {
    await client.del(DOC_KEY(id));
    await client.srem(SET_KEY, id);
  },
};
