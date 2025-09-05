// Defines the maximum file size allowed for uploads, set to 10 megabytes (10 MB).
// Calculation: 10 * 1024 (KB) * 1024 (bytes) = 10,485,760 bytes.
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

// Defines a Set of allowed file extensions for uploaded files.
// Using a Set ensures O(1) lookup time for efficient validation.
// Extensions are lowercase to ensure case-insensitive matching.
export const ALLOWED_EXT = new Set([
  "pdf", // PDF documents
  "png", // PNG images
  "jpg", // JPEG images (common variant)
  "jpeg", // JPEG images (alternate extension)
  "svg", // Scalable Vector Graphics
  "txt", // Plain text files
  "csv", // Comma-separated values files
  "docx", // Microsoft Word documents (modern format)
]);

// Defines a Set of allowed MIME types corresponding to the allowed extensions.
// MIME types are standard identifiers for file formats, often provided by browsers.
// Using a Set ensures efficient lookup for validation.
export const ALLOWED_MIME = new Set([
  "application/pdf", // Matches .pdf
  "image/png", // Matches .png
  "image/jpeg", // Matches .jpg or .jpeg
  "image/svg+xml", // Matches .svg
  "text/plain", // Matches .txt
  "text/csv", // Matches .csv
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // Matches .docx
]);

// Extracts the file extension from a filename.
// @param name - The filename (e.g., 'document.pdf').
// @returns The lowercase extension (e.g., 'pdf') or an empty string if no extension exists.
export function fileExt(name: string): string {
  // Convert filename to lowercase for case-insensitive handling (e.g., 'file.PDF' → 'file.pdf').
  // Split by '.' to separate the extension (e.g., 'document.pdf' → ['document', 'pdf']).
  const parts = name.toLowerCase().split(".");
  // If there's more than one part (i.e., a '.' exists), return the last part as the extension.
  // Otherwise, return an empty string for files without extensions (e.g., 'document').
  return parts.length > 1 ? (parts.pop() as string) : "";
}

// Validates if a file is allowed based on its MIME type or file extension.
// @param mime - The MIME type of the file (e.g., 'application/pdf').
// @param name - The filename (e.g., 'document.pdf').
// @returns True if the file's MIME type or extension is allowed, false otherwise.
export function isAllowedType(mime: string, name: string): boolean {
  // First, check if the MIME type is in the allowed set (more reliable than extension).
  // If it matches, return true immediately.
  if (ALLOWED_MIME.has(mime)) return true;
  // If MIME type is not allowed, extract the file extension using fileExt.
  const ext = fileExt(name);
  // Check if the extracted extension is in the allowed set.
  // Returns true if the extension is valid, false otherwise.
  return ALLOWED_EXT.has(ext);
}
