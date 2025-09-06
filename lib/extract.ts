// Import third-party libraries for different file processing needs
import pdfParse from "pdf-parse"; // Library to extract text from PDF files
// import Tesseract from "tesseract.js"; // OCR (Optical Character Recognition) engine for images - temporarily disabled
import Papa from "papaparse"; // CSV parsing library that handles edge cases well
import mammoth from "mammoth"; // Microsoft Word document (.docx) text extractor

// Define the types of files this utility can process
// This union type ensures type safety - only these values are allowed
export type ExtractKind = "pdf" | "image" | "svg" | "csv" | "docx" | "txt";

// Define the structure of what gets returned after text extraction
export type ExtractResult = {
  text: string; // The extracted text content
  meta: {
    // Metadata about the extraction process
    extractedAt: string; // ISO timestamp of when extraction occurred
    pages?: number; // Optional: number of pages (only for PDFs)
    kind: ExtractKind; // What type of file was processed
  };
};

/**
 * Converts a browser File object to a Node.js Buffer
 *
 * WHY: Browser File objects and Node.js Buffers are different data structures.
 * Most text extraction libraries expect Buffer objects, not File objects.
 *
 * WHAT: Reads the file as an ArrayBuffer (raw binary data), then wraps it
 * in a Node.js Buffer which provides additional methods for data manipulation.
 */
export async function fileToBuffer(file: File): Promise<Buffer> {
  // arrayBuffer() returns a Promise<ArrayBuffer> - raw binary data
  const ab = await file.arrayBuffer();

  // Buffer.from() creates a Node.js Buffer from the ArrayBuffer
  // Buffers are more versatile for file processing than ArrayBuffers
  return Buffer.from(ab);
}

/**
 * Extracts file extension from filename
 *
 * WHY: Sometimes MIME types are missing or incorrect, so file extensions
 * provide a reliable fallback for determining file type.
 *
 * WHAT: Splits filename by dots and returns the last part (extension)
 */
function extOf(name: string): string {
  // Convert to lowercase for case-insensitive comparison
  const parts = name.toLowerCase().split(".");

  // If there's more than one part, return the last one (the extension)
  // Otherwise return empty string (no extension found)
  return parts.length > 1 ? (parts.pop() as string) : "";
}

/**
 * Determines what type of file we're dealing with
 *
 * WHY: Different file types need different processing approaches.
 * PDFs need PDF parsers, images need OCR, etc.
 *
 * STRATEGY: Check MIME type first (more reliable), fall back to file extension
 *
 * MIME TYPES EXPLAINED:
 * - MIME types are standardized identifiers for file formats
 * - Format: "type/subtype" (e.g., "image/jpeg", "application/pdf")
 * - Sent by browsers/servers to identify file content
 */
export function detectKind(mime: string, filename: string): ExtractKind {
  const ext = extOf(filename);

  // PDF files: Standard document format that preserves formatting
  if (mime === "application/pdf" || ext === "pdf") return "pdf";

  // Image files: Photos, screenshots, scanned documents
  // Note: SVG is technically an image but handled separately (it's XML-based)
  if (mime.startsWith("image/") && ext !== "svg") return "image";

  // SVG files: Scalable Vector Graphics - XML-based, may contain text elements
  if (mime === "image/svg+xml" || ext === "svg") return "svg";

  // CSV files: Comma-Separated Values - structured tabular data
  if (mime === "text/csv" || ext === "csv") return "csv";

  // DOCX files: Modern Microsoft Word documents (XML-based format)
  // Long MIME type is the official identifier for .docx files
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  )
    return "docx";

  // Plain text files: Simple unformatted text
  if (mime === "text/plain" || ext === "txt") return "txt";

  // Default fallback: treat unknown files as plain text
  // This is safe because worst case, we just convert bytes to string
  return "txt";
}

/**
 * Main extraction function - processes file buffer based on detected type
 *
 * WHY: Each file format has different internal structure and requires
 * specialized libraries/techniques to extract readable text.
 */
export async function extractFromBuffer(
  buf: Buffer,
  kind: ExtractKind
): Promise<ExtractResult> {
  // Generate timestamp for when extraction occurred
  // ISO format: "2024-01-15T10:30:45.123Z" - standardized, sortable
  const extractedAt = new Date().toISOString();

  // PDF PROCESSING
  if (kind === "pdf") {
    // PDFs contain compressed text, fonts, images in binary format
    // pdf-parse library handles decompression and text extraction
    const res = await pdfParse(buf);
    return {
      // res.text contains all extracted text from all pages
      text: (res.text || "").trim(), // Remove leading/trailing whitespace
      meta: {
        extractedAt,
        pages: res.numpages, // PDF-specific: include page count
        kind,
      },
    };
  }

  // IMAGE PROCESSING (OCR - Optical Character Recognition)
  if (kind === "image") {
    // TEMPORARILY DISABLED: Image OCR disabled due to tesseract.js issues
    return {
      text: "[Image OCR temporarily disabled - tesseract.js configuration issues]",
      meta: { extractedAt, kind },
    };
  }

  // SVG PROCESSING
  if (kind === "svg") {
    // SVGs are XML files that may contain <text> elements with readable content
    // Convert binary buffer to string using UTF-8 encoding
    const raw = buf.toString("utf8");

    // Remove all XML/HTML tags using regex
    // /<[^>]+>/g matches any content between < and >
    const text = raw
      .replace(/<[^>]+>/g, " ") // Replace tags with spaces
      .replace(/\s+/g, " ") // Normalize multiple whitespace to single spaces
      .trim(); // Remove leading/trailing whitespace

    return { text, meta: { extractedAt, kind } };
  }

  // CSV PROCESSING
  if (kind === "csv") {
    // CSVs contain structured data in rows and columns
    // Convert buffer to string for parsing
    const raw = buf.toString("utf8");

    // Papa.parse handles CSV complexities: quotes, escaped commas, different delimiters
    // skipEmptyLines: true removes blank rows that could cause issues
    const parsed = Papa.parse<string[]>(raw, { skipEmptyLines: true });

    // Extract the data array, ensuring it's actually an array
    // Papa.parse can return different structures based on input
    const rows = Array.isArray(parsed.data) ? (parsed.data as string[][]) : [];

    // Convert structured data back to readable text format
    // Join each row's columns with ", " and rows with newlines
    const lines = rows.map((r) => r.join(", "));
    return {
      text: lines.join("\n").trim(),
      meta: { extractedAt, kind },
    };
  }

  // DOCX PROCESSING
  if (kind === "docx") {
    // DOCX files are ZIP archives containing XML files
    // mammoth library extracts text while preserving basic structure
    // extractRawText() gets plain text without formatting
    const res = await mammoth.extractRawText({ buffer: buf });
    return {
      // res.value contains the extracted text content
      text: (res.value || "").trim(),
      meta: { extractedAt, kind },
    };
  }

  // DEFAULT/FALLBACK PROCESSING (Plain text and unknown formats)
  // Simply convert the binary buffer to UTF-8 string
  // This works for plain text files and is a safe fallback for unknown formats
  return {
    text: buf.toString("utf8").trim(),
    meta: { extractedAt, kind },
  };
}
