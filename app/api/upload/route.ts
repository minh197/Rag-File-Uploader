import { NextResponse } from "next/server";
import { store } from "../../../lib/store";
import { newDocId } from "../../../lib/id";
import { MAX_FILE_BYTES, isAllowedType } from "../../../lib/validate";
import type { DocumentRecord } from "../../../lib/types";

/**
 * 
 * 📦 UploadDropzone Component
├── 🎯 Purpose: Let users upload files by dragging or clicking
├── 🔄 State: Tracks if uploading + shows messages
├── 📁 Dropzone: Handles file selection (drag/drop/click)
├── 🌐 API Call: Sends files to your /api/upload endpoint
└── 📢 Feedback: Shows success/error messages to user
 */

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("files") as unknown as File[];

  if (!files || files.length === 0) {
    return NextResponse.json(
      { error: 'No files provided. Use field name "files".' },
      { status: 400 }
    );
  }

  const created: DocumentRecord[] = [];
  const errors: Array<{ filename: string; reason: string }> = [];

  for (const f of files) {
    const filename = (f as any).name ?? "unknown";
    const fileType = f.type ?? "";
    const fileSize = f.size ?? 0;

    if (!isAllowedType(fileType, filename)) {
      errors.push({
        filename,
        reason: `Unsupported type: ${fileType || "unknown"}`,
      });
      continue;
    }
    if (fileSize > MAX_FILE_BYTES) {
      errors.push({ filename, reason: `File too large (> 10MB)` });
      continue;
    }

    const id = newDocId();
    const record: DocumentRecord = {
      id,
      filename,
      fileType,
      fileSize,
      uploadDate: new Date().toISOString(),
      processingStatus: "extracting", // next step will move it through pipeline
      metadata: {},
    };
    store.create(record);
    created.push(record);
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: "All files failed validation", errors },
      { status: 400 }
    );
  }

  return NextResponse.json({ created, errors }, { status: 201 });
}
