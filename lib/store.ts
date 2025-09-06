// lib/store.ts
import { kv, createClient } from "@vercel/kv";

// Enhanced clean function to handle all problematic values
const clean = (obj: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) =>
        v !== undefined &&
        v !== null &&
        v !== "" && // Also filter empty strings if needed
        !(typeof v === "number" && Number.isNaN(v)) &&
        !(typeof v === "string" && v === "undefined") // Filter string "undefined"
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
    // More explicit handling of optional fields
    const payload = clean({
      id: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: String(doc.fileSize),
      uploadDate: doc.uploadDate,
      // Only include these fields if they have actual values
      ...(doc.extractedContent && { extractedContent: doc.extractedContent }),
      processingStatus: doc.processingStatus,
      ...(doc.chunkCount !== undefined &&
        doc.chunkCount !== null && { chunkCount: String(doc.chunkCount) }),
      ...(doc.errorMessage && { errorMessage: doc.errorMessage }),
      ...(doc.metadata && { metadata: JSON.stringify(doc.metadata) }),
    });

    console.log("Payload being stored:", payload); // Debug log

    await client.hset(DOC_KEY(doc.id), payload);
    await client.sadd(SET_KEY, doc.id);
  },

  async update(id: string, patch: Partial<DocumentRecord>) {
    const curr = await this.get(id);
    if (!curr) return;

    const next: DocumentRecord = { ...curr, ...patch };

    // More explicit handling of optional fields
    const payload = clean({
      id: next.id,
      filename: next.filename,
      fileType: next.fileType,
      fileSize: String(next.fileSize),
      uploadDate: next.uploadDate,
      // Only include these fields if they have actual values
      ...(next.extractedContent && { extractedContent: next.extractedContent }),
      processingStatus: next.processingStatus,
      ...(next.chunkCount !== undefined &&
        next.chunkCount !== null && { chunkCount: String(next.chunkCount) }),
      ...(next.errorMessage && { errorMessage: next.errorMessage }),
      ...(next.metadata && { metadata: JSON.stringify(next.metadata) }),
    });

    console.log("Update payload being stored:", payload); // Debug log

    await client.hset(DOC_KEY(id), payload);
  },

  async delete(id: string) {
    await client.del(DOC_KEY(id));
    await client.srem(SET_KEY, id);
  },
};
