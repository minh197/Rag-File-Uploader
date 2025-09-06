// NEXT.JS RUNTIME CONFIGURATION
// WHY: Next.js runs on Edge Runtime by default (limited JavaScript environment)
// Edge Runtime doesn't support Node.js native modules like 'fs', 'buffer', etc.
// pdf-parse and other file processing libraries need full Node.js environment
export const runtime = "nodejs"; // Forces this API route to run on Node.js runtime

// IMPORTS
import { NextResponse } from "next/server"; // Next.js response utilities
import { store } from "../../../lib/store"; // Database/storage abstraction layer
import { newDocId } from "../../../lib/id"; // Unique ID generator for documents
import { MAX_FILE_BYTES, isAllowedType } from "../../../lib/validate"; // File validation
import type { DocumentRecord } from "../../../lib/types"; // TypeScript types
import {
  detectKind,
  extractFromBuffer,
  fileToBuffer,
} from "../../../lib/extract"; // File processing

/**
 * HTTP POST handler for file upload endpoint
 *
 * NEXT.JS API ROUTES EXPLAINED:
 * - Files in pages/api/ or app/api/ become HTTP endpoints
 * - Export functions named after HTTP methods (GET, POST, etc.)
 * - Next.js automatically handles routing and request parsing
 *
 * ENDPOINT: POST /api/upload (or similar based on file location)
 * PURPOSE: Accept multiple files, validate them, extract text, store records
 */
export async function POST(req: Request) {
  // FORM DATA PARSING
  // WHY: File uploads use multipart/form-data encoding, not JSON
  // FormData is the web standard for handling file uploads
  const form = await req.formData();

  // Extract all files from the 'files' field
  // getAll() returns an array because HTML allows multiple files: <input type="file" multiple>
  // Type assertion needed because FormData.getAll() returns FormDataEntryValue[]
  const files = form.getAll("files") as unknown as File[];

  // EARLY VALIDATION: Check if any files were provided
  if (!files || files.length === 0) {
    // Return 400 Bad Request with helpful error message
    // NextResponse.json() creates a JSON response with proper headers
    return NextResponse.json(
      {
        error: 'No files provided. Use field name "files".',
      },
      { status: 400 }
    );
  }

  // RESULT TRACKING ARRAYS
  // WHY: Process multiple files independently - some may succeed, others fail
  // Return detailed results so client knows exactly what happened
  const created: DocumentRecord[] = []; // Successfully processed files
  const errors: Array<{ filename: string; reason: string }> = []; // Failed files with reasons

  // PROCESS EACH FILE INDIVIDUALLY
  // WHY: Independent processing allows partial success
  // If one file fails, others can still be processed successfully
  for (const f of files) {
    // EXTRACT FILE METADATA
    // WHY: File objects from FormData might have inconsistent properties
    // Use fallbacks to handle missing data gracefully
    const filename = (f as File & { name?: string }).name ?? "unknown"; // Filename from client
    const fileType = f.type ?? ""; // MIME type (e.g., "application/pdf")
    const fileSize = f.size ?? 0; // Size in bytes

    // FILE TYPE VALIDATION
    // WHY: Prevent processing of unsupported/dangerous file types
    // Security: Reject executable files, scripts, etc.
    // Efficiency: Only process files we can handle
    if (!isAllowedType(fileType, filename)) {
      errors.push({
        filename,
        reason: `Unsupported type: ${fileType || "unknown"}`,
      });
      continue; // Skip to next file
    }

    // FILE SIZE VALIDATION
    // WHY: Prevent abuse and resource exhaustion
    // Large files consume memory and processing time
    // 10MB limit is reasonable for most document types
    if (fileSize > MAX_FILE_BYTES) {
      errors.push({
        filename,
        reason: `File too large (> 10MB)`,
      });
      continue; // Skip to next file
    }

    // GENERATE UNIQUE DOCUMENT ID
    // WHY: Need consistent way to reference documents across system
    // Database primary key, file storage key, etc.
    const id = newDocId();

    // CREATE INITIAL DATABASE RECORD
    // WHY: Immediately persist document metadata before processing
    // Allows tracking of processing status, handles crashes gracefully
    const base: DocumentRecord = {
      id, // Unique identifier
      filename, // Original filename from upload
      fileType, // MIME type for processing decisions
      fileSize, // Size for storage management
      uploadDate: new Date().toISOString(), // When upload occurred (ISO 8601 format)
      processingStatus: "extracting", // Current processing stage
      metadata: JSON.stringify({}), // FIXED: Explicitly stringify empty object
    };

    // Debug log to verify the payload structure
    console.log("Payload being stored:", {
      id: base.id,
      filename: base.filename,
      fileType: base.fileType,
      fileSize: base.fileSize.toString(),
      uploadDate: base.uploadDate,
      processingStatus: base.processingStatus,
      metadata: base.metadata, // Should be '{}' not '[object Object]'
    });

    // PERSIST TO DATABASE/STORE
    // WHY: Create record immediately so we can update status during processing
    // If processing fails, we still have record of the attempt
    try {
      await store.add(base);
      console.log(`🔄 Processing file: ${filename} (${fileType})`);
    } catch (e: unknown) {
      const reason =
        e instanceof Error ? e.message : "Failed to create document record";
      console.error(`❌ Failed to create record for ${filename}:`, reason);
      errors.push({ filename, reason });
      continue; // Skip to next file
    }

    // TEXT EXTRACTION PROCESS (wrapped in try-catch for error handling)
    try {
      console.log("📦 Converting to buffer...");
      const buf = await fileToBuffer(f);

      console.log("🔍 Detecting file kind...");
      const kind = detectKind(fileType, filename);
      console.log(`📋 Detected kind: ${kind}`);

      console.log("⚡ Extracting text...");
      const { text } = await extractFromBuffer(buf, kind);
      console.log(`✅ Extracted ${text.length} characters`);

      console.log("💾 Updating database...");
      // CRITICAL FIX: Added missing await
      await store.update(id, {
        extractedContent: text, // The extracted text content
        processingStatus: "embedding", // Ready for next stage (vector embeddings)
      });
      console.log("✅ Database updated successfully");

      // Auto-embed: Fire-and-forget call to embedding route
      // This reduces the window where documents can be lost due to server restarts
      try {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        console.log("🚀 Auto-starting embedding process...");
        fetch(`${appUrl}/api/embedding/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: id }),
        }).catch((err) => {
          console.warn("⚠️ Auto-embedding failed (non-blocking):", err.message);
        });
      } catch (err) {
        console.warn("⚠️ Auto-embedding setup failed (non-blocking):", err);
      }
    } catch (e: unknown) {
      // ERROR HANDLING
      // WHY: File processing can fail for many reasons:
      // - Corrupted files, unsupported formats, memory issues, etc.
      // Capture error details for debugging and user feedback

      // Extract error message safely (e could be anything)
      const reason = e instanceof Error ? e.message : "Extraction error";
      console.error(`❌ Extraction failed for ${filename}:`, reason);

      // Update database record with error status
      try {
        // CRITICAL FIX: Added missing await
        await store.update(id, {
          processingStatus: "error",
          errorMessage: reason,
        });
      } catch (updateError) {
        console.error(
          `❌ Failed to update error status for ${filename}:`,
          updateError
        );
      }

      // Add to errors array for response
      errors.push({ filename, reason });
      continue; // Skip to next file
    }

    // SUCCESS: Add to created array
    // Get updated record from store (includes extractedContent, etc.)
    try {
      // CRITICAL FIX: Proper error handling instead of non-null assertion
      const updatedDoc = await store.get(id);
      if (updatedDoc) {
        created.push(updatedDoc);
      } else {
        console.error(`❌ Could not retrieve updated document ${id}`);
        errors.push({
          filename,
          reason: "Failed to retrieve updated document",
        });
      }
    } catch (e) {
      const reason =
        e instanceof Error ? e.message : "Failed to retrieve document";
      console.error(
        `❌ Failed to get updated document for ${filename}:`,
        reason
      );
      errors.push({ filename, reason });
    }
  }

  // RESPONSE GENERATION
  // WHY: Client needs to know what succeeded and what failed

  // TOTAL FAILURE: All files failed processing
  if (created.length === 0) {
    return NextResponse.json(
      {
        error: "All files failed",
        errors,
      },
      { status: 400 }
    );
  }

  // PARTIAL OR COMPLETE SUCCESS
  // Return 201 Created with details of what was processed
  // Include both successes and failures for transparency
  return NextResponse.json(
    {
      created, // Array of successfully processed DocumentRecord objects
      errors, // Array of failed files with reasons (may be empty)
    },
    { status: 201 }
  );
}
