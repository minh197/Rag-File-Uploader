// lib/store.ts
import { kv, createClient } from "@vercel/kv";

// lib/store.ts (top-level, near other helpers)
const clean = (obj: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) =>
        v !== undefined &&
        v !== null &&
        !(typeof v === "number" && Number.isNaN(v))
    )
  );

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
    const payload = clean({
      id: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: String(doc.fileSize),
      uploadDate: doc.uploadDate,
      extractedContent: doc.extractedContent, // will be omitted if undefined
      processingStatus: doc.processingStatus,
      chunkCount: doc.chunkCount != null ? String(doc.chunkCount) : undefined,
      errorMessage: doc.errorMessage,
      metadata: doc.metadata ? JSON.stringify(doc.metadata) : undefined,
    });

    await client.hset(DOC_KEY(doc.id), payload);
    await client.sadd(SET_KEY, doc.id);
  },

  async update(id: string, patch: Partial<DocumentRecord>) {
    const curr = await this.get(id);
    if (!curr) return;

    const next: DocumentRecord = { ...curr, ...patch };

    const payload = clean({
      id: next.id,
      filename: next.filename,
      fileType: next.fileType,
      fileSize: String(next.fileSize),
      uploadDate: next.uploadDate,
      extractedContent: next.extractedContent,
      processingStatus: next.processingStatus,
      chunkCount: next.chunkCount != null ? String(next.chunkCount) : undefined,
      errorMessage: next.errorMessage,
      metadata: next.metadata ? JSON.stringify(next.metadata) : undefined,
    });

    await client.hset(DOC_KEY(id), payload);
  },

  async delete(id: string) {
    await client.del(DOC_KEY(id));
    await client.srem(SET_KEY, id);
  },
};
