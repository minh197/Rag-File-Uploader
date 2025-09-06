// lib/types.ts
export type ProcessingStatus =
  | "uploading"
  | "extracting"
  | "embedding"
  | "completed"
  | "error";

export interface DocumentRecord {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadDate: string; // ISO
  processingStatus: ProcessingStatus;
  extractedContent?: string;
  chunkCount?: number;

  // DB layer stores this as a JSON string; callers may omit it.
  // The store will safely stringify/parse as needed.
  metadata?: string;

  errorMessage?: string;
}

export interface SearchMatch {
  documentId: string;
  filename: string;
  score: number;
  chunkIndex: number;
  snippet: string;
}

export interface ChatSource {
  documentId: string;
  filename: string;
  relevanceScore: number;
  chunkContent: string;
  chunkIndex: number;
}
